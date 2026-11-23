---
"@shopify/hydrogen": minor
---

New `SearchUpdates` component for React and Vue sends Shopify's `shopify:search:update` event for each filter or sort change that the customer makes on the search page. Render it inside the search page's `CollectionProvider`, around the filters, the results, and the empty state, and pass the search term and the Storefront API `totalCount`. The event's promise resolves with the total count after the new results render, or rejects with an `AbortError` when the search term changes first. `ShopifyScripts` and `initializeShopifyScripts` register the element.

Frameworks without a binding render `SEARCH_UPDATES_TAG_NAME` with the attributes from `getSearchUpdatesAttributes({ query, totalCount, status })` and set `element.store = store` (`SearchUpdatesElement`).
