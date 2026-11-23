"use client";

import { createElement, type HTMLAttributes, type ReactElement } from "react";

import {
  getSearchUpdatesAttributes,
  SEARCH_UPDATES_TAG_NAME,
  type SearchUpdatesOptions,
} from "../core/collection/search-updates";
import { useUpdateEventElement } from "./collection-updates";

/**
 * Props for the `SearchUpdates` component: the search term, the total number of results, and HTML
 * attributes such as `className` for the element.
 *
 * @publicDocs
 */
export type SearchUpdatesProps = Omit<SearchUpdatesOptions, "status"> & HTMLAttributes<HTMLElement>;

/**
 * Sends the `shopify:search:update` event for each filter or sort change that the customer makes on
 * the search page. Render it inside the search page's `CollectionProvider`. It throws outside a
 * provider. `ShopifyScripts` registers the element.
 *
 * The event starts at the element, so wrap the filters, the results, and the empty state. Then the
 * element stays on the page when a filter matches no products.
 *
 * The event has the search term, the active filters, and the sort key (`PRICE` or `RELEVANCE`). Its
 * promise resolves with the `totalCount` that the component renders after the provider settles.
 * Pass the `totalCount` of the Storefront API `search` query, from the same data as the results.
 *
 * @param props - The search term, the total number of results, the children, and HTML attributes for the element.
 * @returns The search updates element.
 * @publicDocs
 */
export function SearchUpdates({
  query,
  totalCount,
  children,
  className,
  ...rest
}: SearchUpdatesProps): ReactElement {
  const { status, ref } = useUpdateEventElement("SearchUpdates");

  return createElement(
    SEARCH_UPDATES_TAG_NAME,
    // React 18 sets `className` on custom elements as a `classname` attribute, so pass `class`.
    {
      ...rest,
      class: className,
      ...getSearchUpdatesAttributes({ query, totalCount, status }),
      ref,
    },
    children,
  );
}
