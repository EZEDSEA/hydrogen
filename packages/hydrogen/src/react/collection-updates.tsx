"use client";

import {
  createElement,
  useEffect,
  useRef,
  type HTMLAttributes,
  type ReactElement,
  type RefObject,
} from "react";

import type { CollectionState, CollectionStore } from "../core/collection";
import {
  COLLECTION_UPDATES_TAG_NAME,
  getCollectionUpdatesAttributes,
  type CollectionUpdatesOptions,
} from "../core/collection/collection-updates";
import { useCollection, useRequiredStore } from "./collection";

/**
 * Props for the `CollectionUpdates` component: the collection, the number of products that the
 * page shows, and HTML attributes such as `className` for the element.
 *
 * @publicDocs
 */
export type CollectionUpdatesProps = Omit<CollectionUpdatesOptions, "status"> &
  HTMLAttributes<HTMLElement>;

/**
 * Sends the `shopify:collection:update` event for each filter or sort change that the customer
 * makes. Render it inside `CollectionProvider`. It throws outside a provider. `ShopifyScripts`
 * registers the element.
 *
 * The event starts at the element, so wrap the filter and sort controls, the results, and the empty
 * state. It doesn't need a fixed place relative to `CollectionView`.
 *
 * The event has the products count before the change. Its promise resolves with the
 * `productsCount` that the component renders after the provider settles. Pass the count of the
 * results that the page shows, from the same data as the results.
 *
 * @param props - The collection, the products count, the children, and HTML attributes for the element.
 * @returns The collection updates element.
 * @publicDocs
 */
export function CollectionUpdates({
  collection,
  productsCount,
  children,
  className,
  ...rest
}: CollectionUpdatesProps): ReactElement {
  const { status, ref } = useUpdateEventElement("CollectionUpdates");

  return createElement(
    COLLECTION_UPDATES_TAG_NAME,
    // React 18 sets `className` on custom elements as a `classname` attribute, so pass `class`.
    {
      ...rest,
      class: className,
      ...getCollectionUpdatesAttributes({ collection, productsCount, status }),
      ref,
    },
    children,
  );
}

/**
 * Connects an update element to the store of the nearest `CollectionProvider`. Returns the store
 * status for the element's payload and the ref for the element. Throws outside a provider, with
 * `name` in the message.
 *
 * @internal
 */
export function useUpdateEventElement(name: string): {
  status: CollectionState["status"];
  ref: RefObject<(HTMLElement & { store: CollectionStore | null }) | null>;
} {
  const store = useRequiredStore(name);
  const status = useCollection((state) => state.status);
  const ref = useRef<HTMLElement & { store: CollectionStore | null }>(null);

  // Set the property in an effect, not as a prop: React 18 renders unknown props as attributes,
  // and so does React 19 before the element is registered.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.store = store;
    return () => {
      element.store = null;
    };
  }, [store]);

  return { status, ref };
}
