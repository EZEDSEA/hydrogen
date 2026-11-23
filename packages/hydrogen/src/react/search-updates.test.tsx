// @vitest-environment happy-dom
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { CollectionActions } from "../core/collection";
import {
  defineSearchUpdates,
  SEARCH_UPDATES_TAG_NAME,
  type SearchUpdatesElement,
} from "../core/collection/search-updates";
import { assert } from "../core/test-utils";
import { CollectionProvider, useCollectionActions } from "./collection";
import { SearchUpdates } from "./search-updates";

type UpdateEvent = Event & {
  search: { query: string; productFilters?: unknown; sortKey?: string };
  promise: Promise<{ totalCount: number }>;
};

vi.mock("../core/shopify-scripts/standard-events", async () => {
  const { fakeStandardEvents } = await import("../core/collection/__tests__/fake-standard-events");
  return { importStandardEventsFromCDN: () => Promise.resolve(fakeStandardEvents) };
});

let actions: CollectionActions | undefined;
function Controls() {
  actions = useCollectionActions();
  return null;
}

function getActions() {
  assert(actions, "expected the collection actions");
  return actions;
}

function page(urlSearch: string, dataSearch: string, totalCount: number) {
  return createElement(
    CollectionProvider,
    { data: { handle: "search:shirt", dataSearch }, urlSearch, onChange: () => {} },
    createElement(
      SearchUpdates,
      { query: "shirt", totalCount, className: "results" },
      createElement(Controls),
    ),
  );
}

function getElement(container: HTMLElement) {
  const element = container.querySelector<SearchUpdatesElement>(SEARCH_UPDATES_TAG_NAME);
  assert(element, "expected a search updates element");
  return element;
}

const events: UpdateEvent[] = [];
const record = (event: Event) => events.push(event as UpdateEvent);
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

function eventAt(index: number): UpdateEvent {
  const event = events[index];
  assert(event, `expected search update event ${index}`);
  return event;
}

describe("SearchUpdates", () => {
  beforeAll(() => {
    defineSearchUpdates();
  });

  afterEach(() => {
    document.removeEventListener("shopify:search:update", record);
    events.length = 0;
    actions = undefined;
  });

  it("throws outside a CollectionProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(createElement(SearchUpdates, { query: "shirt", totalCount: 1 }))).toThrow(
      "SearchUpdates must be used inside a <CollectionProvider>.",
    );
    vi.restoreAllMocks();
  });

  it("sets the provider's store, so a filter change sends an update that resolves with the new total count", async () => {
    document.addEventListener("shopify:search:update", record);
    const { container, rerender } = render(page("q=shirt", "q=shirt", 12));
    await flush();
    const element = getElement(container);

    expect(element.getAttribute("class")).toBe("results");
    expect(element.store?.getState().handle).toBe("search:shirt");

    act(() => getActions().toggleFilter({ productVendor: "Acme" }));
    expect(events.map((event) => event.search)).toEqual([
      { query: "shirt", productFilters: [{ productVendor: "Acme" }] },
    ]);

    // The router moves to the new URL first, then the loader data arrives.
    const search = "q=shirt&filter.p.vendor=Acme";
    rerender(page(search, "q=shirt", 12));
    rerender(page(search, search, 0));

    await expect(eventAt(0).promise).resolves.toEqual({ totalCount: 0 });
  });
});
