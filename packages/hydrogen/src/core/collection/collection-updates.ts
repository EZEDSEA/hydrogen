import type * as StandardEvents from "../../../vendor/standard-events";
import type { CollectionStore } from "./collection";
import type { CollectionViewCollection } from "./collection-view";
import type { CollectionState } from "./state";
import { defineUpdateEventElement, type UpdateEventOptions } from "./update-event-element";

/**
 * Tag name of the collection updates custom element, `shopify-collection-updates`.
 *
 * On a framework without a Hydrogen binding, render the tag with the attributes from
 * `getCollectionUpdatesAttributes` and set the element's `store` property. See
 * `CollectionUpdatesElement`.
 *
 * @publicDocs
 */
export const COLLECTION_UPDATES_TAG_NAME = "shopify-collection-updates";

const PAYLOAD = "collection-update-payload";

/** The collection, the number of its products that the page shows, and the store status. */
export interface CollectionUpdatesOptions {
  /** Collection fields from your Storefront API query. */
  collection: CollectionViewCollection;
  /**
   * The Storefront API has no product total for a collection, so pass the number of products that
   * the page loaded.
   */
  productsCount: number;
  /**
   * The current `status` of the collection store. Render the attributes again when it changes.
   * The element resolves update promises with the first `productsCount` that you render with
   * `idle`.
   */
  status: CollectionState["status"];
}

/**
 * Returns the attributes of the collection updates element. Render them on a
 * `COLLECTION_UPDATES_TAG_NAME` element on a framework without a Hydrogen binding, and render them
 * again when the products count or the store status changes. Set the value as an HTML attribute,
 * such as with `attr:` on Solid.
 *
 * @param options - The collection, the number of products that the page loaded, and the store status.
 * @returns The `collection-update-payload` attribute.
 * @publicDocs
 */
export function getCollectionUpdatesAttributes({
  collection,
  productsCount,
  status,
}: CollectionUpdatesOptions): Record<typeof PAYLOAD, string> {
  const payload: CollectionUpdatesOptions = {
    collection: { id: collection.id, handle: collection.handle },
    productsCount,
    status,
  };
  return { [PAYLOAD]: JSON.stringify(payload) };
}

/**
 * The collection updates element, `COLLECTION_UPDATES_TAG_NAME`.
 *
 * Set `store` to the collection store of the page. The element then sends
 * `shopify:collection:update` for each filter or sort change that the customer makes. The event has
 * the products count before the change. Its promise resolves with the products count that the page
 * renders after the store settles. Set `store` to `null` to stop. The element reads a value that
 * you set before it is registered.
 *
 * @publicDocs
 */
export type CollectionUpdatesElement = HTMLElement & { store: CollectionStore | null };

type CollectionUpdatePayload = Omit<StandardEvents.CollectionUpdatePayload, "promise">;

const collectionUpdates: UpdateEventOptions<
  CollectionUpdatesOptions,
  CollectionUpdatePayload,
  StandardEvents.CollectionUpdateResult
> = {
  payloadAttribute: PAYLOAD,
  getEventClass: (module) => module.CollectionUpdateEvent,
  getKey: ({ collection }) => collection.handle,
  getResult: ({ productsCount }) => ({ productsCount }),
  createEventPayload: ({ collection, productsCount }, { filters, sortKey }) => {
    const payload: CollectionUpdatePayload = {
      collection: { id: collection.id, handle: collection.handle, productsCount },
    };
    if (filters.length > 0) payload.productFilters = filters;
    if (sortKey !== undefined) payload.sortKey = sortKey;
    return payload;
  },
  abortMessage:
    "The collection or its store changed, or the updates element disconnected, before the update finished.",
};

/**
 * Registers the collection updates custom element in the browser right away. The element loads
 * Shopify's Standard Events module only to create events. The function does nothing on the server
 * or when the element is already registered. `initializeShopifyScripts` and the `ShopifyScripts`
 * component call it for you.
 *
 * @publicDocs
 */
export function defineCollectionUpdates(): void {
  defineUpdateEventElement(COLLECTION_UPDATES_TAG_NAME, collectionUpdates);
}
