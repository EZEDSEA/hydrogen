// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { assert } from "../../test-utils";
import { createCollectionStore, type CollectionStore } from "../collection";
import {
  defineSearchUpdates,
  getSearchUpdatesAttributes,
  SEARCH_UPDATES_TAG_NAME,
  type SearchUpdatesElement,
} from "../search-updates";
import type { CollectionState } from "../state";

vi.mock("../../shopify-scripts/standard-events", async () => {
  const { fakeStandardEvents } = await import("./fake-standard-events");
  return { importStandardEventsFromCDN: () => Promise.resolve(fakeStandardEvents) };
});

type UpdateResult = { totalCount: number };
type UpdateEvent = Event & {
  search: { query: string; productFilters?: unknown; sortKey?: string };
  promise: Promise<UpdateResult>;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Renders the attribute the way a binding does: with the total count and the store status. */
function render(
  element: Element,
  totalCount: number,
  status: CollectionState["status"],
  query = "shirt",
) {
  const attributes = getSearchUpdatesAttributes({ query, totalCount, status });
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
}

async function mount(store: CollectionStore, totalCount = 12) {
  const element = document.createElement(SEARCH_UPDATES_TAG_NAME) as SearchUpdatesElement;
  render(element, totalCount, "idle");
  element.store = store;
  document.body.append(element);
  await flush();
  return element;
}

function createStore() {
  return createCollectionStore({ data: { handle: "search:shirt", dataSearch: "" } });
}

const events: UpdateEvent[] = [];
const record = (event: Event) => events.push(event as UpdateEvent);

function eventAt(index: number): UpdateEvent {
  const event = events[index];
  assert(event, `expected search update event ${index}`);
  return event;
}

describe("search updates element", () => {
  beforeAll(() => {
    defineSearchUpdates();
  });

  beforeEach(() => {
    document.addEventListener("shopify:search:update", record);
  });

  afterEach(() => {
    document.removeEventListener("shopify:search:update", record);
    events.length = 0;
    document.body.innerHTML = "";
  });

  it("sends the query and filters and resolves with the total count rendered with idle", async () => {
    const store = createStore();
    const element = await mount(store, 12);

    store.setFilters([{ productVendor: "Acme" }, { available: true }]);

    expect(events).toHaveLength(1);
    const event = eventAt(0);
    expect(event.target).toBe(element);
    expect(event.search).toEqual({
      query: "shirt",
      productFilters: [{ productVendor: "Acme" }, { available: true }],
    });

    render(element, 12, "loading");
    await flush();
    store.settle();
    render(element, 0, "idle");

    await expect(event.promise).resolves.toEqual({ totalCount: 0 });
  });

  it("maps price sorts to PRICE and other sorts to RELEVANCE, and omits the default sort", async () => {
    const store = createStore();
    await mount(store);

    store.setSortKey("PRICE", true);
    store.setSortKey("RELEVANCE");
    store.setSortKey("TITLE");
    store.reset();

    expect(events.map((event) => event.search)).toEqual([
      { query: "shirt", sortKey: "PRICE" },
      { query: "shirt", sortKey: "RELEVANCE" },
      { query: "shirt", sortKey: "RELEVANCE" },
      { query: "shirt" },
    ]);
  });

  it("rejects pending promises with an AbortError when the query changes", async () => {
    const store = createStore();
    const element = await mount(store);

    store.setSortKey("PRICE");
    render(element, 3, "idle", "pants");

    const error = await eventAt(0).promise.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(DOMException);
    expect(error).toMatchObject({ name: "AbortError" });
  });
});
