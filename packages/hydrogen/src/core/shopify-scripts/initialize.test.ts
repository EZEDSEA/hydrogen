// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

import type * as StandardEventsModule from "../../../vendor/standard-events";
import { COLLECTION_UPDATES_TAG_NAME } from "../collection/collection-updates";
import { COLLECTION_VIEW_TAG_NAME } from "../collection/collection-view";
import { SEARCH_UPDATES_TAG_NAME } from "../collection/search-updates";
import { PRODUCT_VIEW_TAG_NAME } from "../product/product-view";
import { initializeShopifyScripts } from "./initialize";

vi.mock("./standard-events", () => ({
  importStandardEventsFromCDN: () =>
    Promise.resolve({
      createViewEventElement: () => class extends HTMLElement {},
      PageViewEvent: class extends Event {
        constructor() {
          super("shopify:page:view");
        }
      },
    } as unknown as typeof StandardEventsModule),
}));

describe("initializeShopifyScripts", () => {
  it("registers the view event elements and the update elements", async () => {
    const initialized = initializeShopifyScripts({ webMcp: false });

    // Hydrogen's own elements don't wait for the Standard Events module.
    expect(customElements.get(COLLECTION_UPDATES_TAG_NAME)).toBeDefined();
    expect(customElements.get(SEARCH_UPDATES_TAG_NAME)).toBeDefined();
    await initialized;

    await vi.waitFor(() => {
      expect(customElements.get(PRODUCT_VIEW_TAG_NAME)).toBeDefined();
      expect(customElements.get(COLLECTION_VIEW_TAG_NAME)).toBeDefined();
    });
  });
});
