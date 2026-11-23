import {
  getCollectionUpdatesAttributes,
  type CollectionStore,
  type CollectionUpdatesOptions,
} from "@shopify/hydrogen";
import type { JSX } from "solid-js";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "shopify-collection-updates": HTMLAttributes<HTMLElement>;
    }
    interface ExplicitAttributes {
      "collection-update-payload": string;
    }
    interface ExplicitProperties {
      store: CollectionStore | null;
    }
  }
}

/**
 * Renders Hydrogen's collection updates element, which sends `shopify:collection:update` for each
 * filter or sort change. Wrap the filter and sort controls, the results, and the empty state.
 */
export function CollectionUpdates(
  props: CollectionUpdatesOptions & {
    store: CollectionStore;
    class?: string;
    children: JSX.Element;
  },
) {
  const attributes = () =>
    getCollectionUpdatesAttributes({
      collection: props.collection,
      productsCount: props.productsCount,
      status: props.status,
    });
  // `attr:` sets the payload as an HTML attribute, which the element reads. `prop:` sets the store
  // as a property, and sets it again when the store changes.
  return (
    <shopify-collection-updates
      attr:collection-update-payload={attributes()["collection-update-payload"]}
      prop:store={props.store}
      class={props.class}
    >
      {props.children}
    </shopify-collection-updates>
  );
}
