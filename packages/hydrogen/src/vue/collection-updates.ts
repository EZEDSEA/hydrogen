import { defineComponent, h, shallowRef, watchEffect, type Ref, type ShallowRef } from "vue";

import type { CollectionState, CollectionStore } from "../core/collection";
import {
  COLLECTION_UPDATES_TAG_NAME,
  getCollectionUpdatesAttributes,
  type CollectionUpdatesOptions,
} from "../core/collection/collection-updates";
import { useCollection, useRequiredStoreRef } from "./collection";

/**
 * Props for the Vue `CollectionUpdates` component.
 *
 * @publicDocs
 */
export type CollectionUpdatesProps = Omit<CollectionUpdatesOptions, "status">;

/**
 * Sends the `shopify:collection:update` event for each filter or sort change that the customer
 * makes. Render it inside the collection provider. It throws outside a provider. `ShopifyScripts`
 * registers the element.
 *
 * The event starts at the element, so wrap the filter and sort controls, the results, and the empty
 * state. Attributes such as `class` go on the element. It doesn't need a fixed place relative to
 * `CollectionView`.
 *
 * The event has the products count before the change. Its promise resolves with the
 * `productsCount` that the component renders after the provider settles. Pass the count of the
 * results that the page shows, from the same data as the results.
 *
 * @publicDocs
 */
export const CollectionUpdates = defineComponent(
  (props: CollectionUpdatesProps, { slots }) => {
    const { status, element } = useUpdateEventElement("CollectionUpdates");

    return () =>
      h(
        COLLECTION_UPDATES_TAG_NAME,
        {
          ...getCollectionUpdatesAttributes({
            collection: props.collection,
            productsCount: props.productsCount,
            status: status.value,
          }),
          ref: element,
        },
        slots.default?.(),
      );
  },
  {
    name: "CollectionUpdates",
    props: {
      collection: { type: null, required: true },
      productsCount: { type: null, required: true },
    },
  },
);

/**
 * Connects an update element to the store of the nearest collection provider, and to the new
 * store when the provider replaces it. Returns the store status for the element's payload and the
 * template ref for the element. Throws outside a provider, with `name` in the message.
 *
 * @internal
 */
export function useUpdateEventElement(name: string): {
  status: Readonly<Ref<CollectionState["status"]>>;
  element: ShallowRef<(HTMLElement & { store: CollectionStore | null }) | undefined>;
} {
  const storeRef = useRequiredStoreRef(name);
  const status = useCollection((state) => state.status);
  const element = shallowRef<HTMLElement & { store: CollectionStore | null }>();

  watchEffect(() => {
    if (element.value) element.value.store = storeRef.value;
  });

  return { status, element };
}
