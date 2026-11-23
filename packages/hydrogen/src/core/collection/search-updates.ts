import type * as StandardEvents from "../../../vendor/standard-events";
import type { CollectionStore } from "./collection";
import type { CollectionState } from "./state";
import { defineUpdateEventElement, type UpdateEventOptions } from "./update-event-element";

/**
 * Tag name of the search updates custom element, `shopify-search-updates`.
 *
 * On a framework without a Hydrogen binding, render the tag with the attributes from
 * `getSearchUpdatesAttributes` and set the element's `store` property. See `SearchUpdatesElement`.
 *
 * @publicDocs
 */
export const SEARCH_UPDATES_TAG_NAME = "shopify-search-updates";

const PAYLOAD = "search-update-payload";

/** The search term, the total number of results, and the store status. */
export interface SearchUpdatesOptions {
  /** Search term of the results. The search update events send it as `search.query`. */
  query: string;
  /** Total number of results, from the `totalCount` field of the Storefront API `search` query. */
  totalCount: number;
  /**
   * The current `status` of the collection store of the search page. Render the attributes again
   * when it changes. The element resolves update promises with the first `totalCount` that you
   * render with `idle`.
   */
  status: CollectionState["status"];
}

/**
 * Returns the attributes of the search updates element. Render them on a
 * `SEARCH_UPDATES_TAG_NAME` element on a framework without a Hydrogen binding, and render them again
 * when the total count or the store status changes. Set the value as an HTML attribute, such as with
 * `attr:` on Solid.
 *
 * @param options - The search term, the total number of results, and the store status.
 * @returns The `search-update-payload` attribute.
 * @publicDocs
 */
export function getSearchUpdatesAttributes({
  query,
  totalCount,
  status,
}: SearchUpdatesOptions): Record<typeof PAYLOAD, string> {
  const payload: SearchUpdatesOptions = { query, totalCount, status };
  return { [PAYLOAD]: JSON.stringify(payload) };
}

/**
 * The search updates element, `SEARCH_UPDATES_TAG_NAME`.
 *
 * Set `store` to the collection store of the search page. The element then sends
 * `shopify:search:update` for each filter or sort change that the customer makes. Its promise
 * resolves with the total count that the page renders after the store settles. Set `store` to
 * `null` to stop. The element reads a value that you set before it is registered.
 *
 * @publicDocs
 */
export type SearchUpdatesElement = HTMLElement & { store: CollectionStore | null };

type SearchUpdatePayload = Omit<StandardEvents.SearchUpdatePayload, "promise">;

const searchUpdates: UpdateEventOptions<
  SearchUpdatesOptions,
  SearchUpdatePayload,
  StandardEvents.SearchUpdateResult
> = {
  payloadAttribute: PAYLOAD,
  getEventClass: (module) => module.SearchUpdateEvent,
  getKey: ({ query }) => query,
  getResult: ({ totalCount }) => ({ totalCount }),
  createEventPayload: ({ query }, { filters, sortKey }) => {
    const search: SearchUpdatePayload["search"] = { query };
    if (filters.length > 0) search.productFilters = filters;
    // Search sorts only by relevance or price. Standard Events' `getSortKey` maps sort values the same way.
    if (sortKey !== undefined) search.sortKey = sortKey === "PRICE" ? "PRICE" : "RELEVANCE";
    return { search };
  },
  abortMessage:
    "The search or its store changed, or the updates element disconnected, before the update finished.",
};

/**
 * Registers the search updates custom element in the browser right away. The element loads
 * Shopify's Standard Events module only to create events. The function does nothing on the server
 * or when the element is already registered. `initializeShopifyScripts` and the `ShopifyScripts`
 * component call it for you.
 *
 * @publicDocs
 */
export function defineSearchUpdates(): void {
  defineUpdateEventElement(SEARCH_UPDATES_TAG_NAME, searchUpdates);
}
