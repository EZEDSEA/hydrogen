import { defineComponent, h } from "vue";

import {
  getSearchUpdatesAttributes,
  SEARCH_UPDATES_TAG_NAME,
  type SearchUpdatesOptions,
} from "../core/collection/search-updates";
import { useUpdateEventElement } from "./collection-updates";

/**
 * Props for the Vue `SearchUpdates` component.
 *
 * @publicDocs
 */
export type SearchUpdatesProps = Omit<SearchUpdatesOptions, "status">;

/**
 * Sends the `shopify:search:update` event for each filter or sort change that the customer makes on
 * the search page. Render it inside the search page's collection provider. It throws outside a
 * provider. `ShopifyScripts` registers the element.
 *
 * The event starts at the element, so wrap the filters, the results, and the empty state. Then the
 * element stays on the page when a filter matches no products. Attributes such as `class` go on
 * the element.
 *
 * The event has the search term, the active filters, and the sort key (`PRICE` or `RELEVANCE`). Its
 * promise resolves with the `totalCount` that the component renders after the provider settles.
 * Pass the `totalCount` of the Storefront API `search` query, from the same data as the results.
 *
 * @publicDocs
 */
export const SearchUpdates = defineComponent(
  (props: SearchUpdatesProps, { slots }) => {
    const { status, element } = useUpdateEventElement("SearchUpdates");

    return () =>
      h(
        SEARCH_UPDATES_TAG_NAME,
        {
          ...getSearchUpdatesAttributes({
            query: props.query,
            totalCount: props.totalCount,
            status: status.value,
          }),
          ref: element,
        },
        slots.default?.(),
      );
  },
  {
    name: "SearchUpdates",
    props: {
      query: { type: null, required: true },
      totalCount: { type: null, required: true },
    },
  },
);
