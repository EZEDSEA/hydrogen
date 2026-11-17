---
"@shopify/hydrogen": minor
---

New `CollectionUpdates` component for React and Vue sends Shopify's `shopify:collection:update` event for each filter or sort change that the customer makes. Render it inside `CollectionProvider`, around the filter and sort controls, the results, and the empty state, and pass the collection and the number of products that the page shows. The event's promise resolves with the products count after the new results render, or rejects with an `AbortError` when the customer leaves the collection first. `ShopifyScripts` and `initializeShopifyScripts` register the element.

Frameworks without a binding render `COLLECTION_UPDATES_TAG_NAME` with the attributes from `getCollectionUpdatesAttributes({ collection, productsCount, status })` and set `element.store = store` (`CollectionUpdatesElement`).

The collection store has a new `subscribeBrowseChange(listener)` method for listeners of the customer's filter and sort changes.
