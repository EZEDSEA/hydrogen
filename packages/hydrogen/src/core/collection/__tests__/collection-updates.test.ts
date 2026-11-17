// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { assert } from "../../test-utils";
import { createCollectionStore, type CollectionStore } from "../collection";
import {
  COLLECTION_UPDATES_TAG_NAME,
  defineCollectionUpdates,
  getCollectionUpdatesAttributes,
  type CollectionUpdatesElement,
} from "../collection-updates";
import type { CollectionState } from "../state";
import { fakeStandardEvents } from "./fake-standard-events";

const importStandardEventsFromCDN = vi.hoisted(() => vi.fn());
vi.mock("../../shopify-scripts/standard-events", () => ({ importStandardEventsFromCDN }));

type UpdateResult = { productsCount: number };
type UpdateEvent = Event & {
  collection: { id: string | null; handle: string; productsCount: number };
  productFilters?: unknown;
  sortKey?: string;
  promise: Promise<UpdateResult>;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const rejection = (promise: Promise<unknown>) => promise.catch((reason: unknown) => reason);

/** Renders the attribute the way a binding does: with the count and the store status. */
function render(
  element: Element,
  productsCount: number,
  status: CollectionState["status"],
  handle = "shirts",
) {
  const collection = { id: `gid://shopify/Collection/${handle}`, handle };
  const attributes = getCollectionUpdatesAttributes({ collection, productsCount, status });
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
}

function createElement(productsCount: number) {
  const element = document.createElement(COLLECTION_UPDATES_TAG_NAME) as CollectionUpdatesElement;
  render(element, productsCount, "idle");
  return element;
}

function createStore() {
  return createCollectionStore({ data: { handle: "shirts", dataSearch: "" } });
}

async function mount(store: CollectionStore, productsCount = 8) {
  const element = createElement(productsCount);
  element.store = store;
  document.body.append(element);
  await flush();
  return element;
}

const events: UpdateEvent[] = [];
const record = (event: Event) => events.push(event as UpdateEvent);

function eventAt(index: number): UpdateEvent {
  const event = events[index];
  assert(event, `expected update event ${index}`);
  return event;
}

describe("collection updates element", () => {
  beforeAll(() => {
    defineCollectionUpdates();
  });

  beforeEach(() => {
    importStandardEventsFromCDN.mockResolvedValue(fakeStandardEvents);
    document.addEventListener("shopify:collection:update", record);
  });

  afterEach(() => {
    document.removeEventListener("shopify:collection:update", record);
    events.length = 0;
    document.body.innerHTML = "";
  });

  it("sends the count before the change right away and resolves with the count rendered after settling", async () => {
    const store = createStore();
    const element = await mount(store, 8);

    store.setSortKey("PRICE", true);

    expect(events).toHaveLength(1);
    const event = eventAt(0);
    expect(event.target).toBe(element);
    expect(event.collection).toEqual({
      id: "gid://shopify/Collection/shirts",
      handle: "shirts",
      productsCount: 8,
    });
    expect(event.sortKey).toBe("PRICE");
    expect(event).not.toHaveProperty("productFilters");

    // The new results load in a later step.
    await flush();
    store.settle();
    // A render from before the store settled writes the old count, and the page renders the new
    // results in a later task.
    render(element, 8, "loading");
    await flush();
    let settled: UpdateResult | undefined;
    void event.promise.then((result) => (settled = result));
    await flush();
    expect(settled).toBeUndefined();

    render(element, 3, "idle");

    await expect(event.promise).resolves.toEqual({ productsCount: 3 });
  });

  it("resolves when the new results have the same count", async () => {
    const store = createStore();
    const element = await mount(store, 8);

    store.setSortKey("TITLE");
    render(element, 8, "loading");
    await flush();
    store.settle();
    render(element, 8, "idle");

    await expect(eventAt(0).promise).resolves.toEqual({ productsCount: 8 });
  });

  it("sends one event per change and resolves all of them with the final count", async () => {
    const store = createStore();
    const element = await mount(store, 8);

    store.toggleFilter({ tag: "sale" });
    store.reset();
    render(element, 8, "loading");
    await flush();
    store.settle();
    render(element, 5, "idle");

    expect(events).toHaveLength(2);
    expect(eventAt(0).productFilters).toEqual([{ tag: "sale" }]);
    expect(eventAt(1)).not.toHaveProperty("productFilters");
    expect(eventAt(1)).not.toHaveProperty("sortKey");
    await expect(Promise.all(events.map((event) => event.promise))).resolves.toEqual([
      { productsCount: 5 },
      { productsCount: 5 },
    ]);
  });

  it("resolves with the current count when the store settles in the same step as the change", async () => {
    const store = createStore();
    const element = await mount(store, 8);
    const setAttribute = vi.spyOn(element, "setAttribute");

    // Such as a filter turned on and off before the URL changed: no new results load, and the page
    // renders the same payload, which changes no attribute.
    store.toggleFilter({ tag: "sale" });
    store.toggleFilter({ tag: "sale" });
    store.settle();

    expect(events).toHaveLength(2);
    await expect(Promise.all(events.map((event) => event.promise))).resolves.toEqual([
      { productsCount: 8 },
      { productsCount: 8 },
    ]);
    expect(setAttribute).not.toHaveBeenCalled();
  });

  it("resolves a change from before the module loads with the current count when the store settles in the same step", async () => {
    const load = Promise.withResolvers<unknown>();
    importStandardEventsFromCDN.mockReturnValue(load.promise);
    const store = createStore();
    await mount(store, 8);

    store.setSortKey("PRICE");
    store.settle();
    load.resolve(fakeStandardEvents);
    await flush();

    await expect(eventAt(0).promise).resolves.toEqual({ productsCount: 8 });
  });

  it("sends nothing for back and forward navigation", async () => {
    const store = createStore();
    const element = await mount(store);

    store.syncFromParams(new URLSearchParams("sort_by=price-ascending"));
    render(element, 8, "loading");
    store.settle();
    render(element, 20, "idle");
    await flush();

    expect(events).toHaveLength(0);
  });

  it("rejects pending promises with an AbortError when the collection handle changes", async () => {
    const store = createStore();
    const element = await mount(store);

    store.setSortKey("PRICE");
    render(element, 4, "idle", "pants");

    const error = await rejection(eventAt(0).promise);
    expect(error).toBeInstanceOf(DOMException);
    expect(error).toMatchObject({ name: "AbortError" });
  });

  it("rejects pending promises on disconnect and listens again on reconnect", async () => {
    const store = createStore();
    const element = await mount(store);

    store.setSortKey("PRICE");
    element.remove();

    expect(await rejection(eventAt(0).promise)).toMatchObject({ name: "AbortError" });
    store.setSortKey("TITLE");
    expect(events).toHaveLength(1);

    document.body.append(element);
    store.setSortKey("ID");
    expect(events).toHaveLength(2);
  });

  it("rejects pending promises and follows the new store when the store is replaced or removed", async () => {
    const first = createStore();
    const element = await mount(first);

    first.setSortKey("PRICE");
    const second = createStore();
    element.store = second;

    expect(await rejection(eventAt(0).promise)).toMatchObject({ name: "AbortError" });
    first.setSortKey("TITLE");
    second.setSortKey("TITLE");
    expect(events).toHaveLength(2);

    element.store = null;

    expect(await rejection(eventAt(1).promise)).toMatchObject({ name: "AbortError" });
    second.setSortKey("ID");
    expect(events).toHaveLength(2);
  });

  it("reads a store that was set before the element was registered", async () => {
    const store = createStore();
    const element = createElement(8);
    // happy-dom doesn't upgrade elements. Put the value where a browser leaves it before the
    // upgrade: in an own property that hides the setter.
    Object.defineProperty(element, "store", { value: store, writable: true, configurable: true });
    document.body.append(element);
    await flush();

    expect(Object.hasOwn(element, "store")).toBe(false);
    expect(element.store).toBe(store);
    store.setSortKey("PRICE");
    expect(events).toHaveLength(1);
  });

  it("sends queued events when the module loads, each with its own result", async () => {
    const load = Promise.withResolvers<unknown>();
    importStandardEventsFromCDN.mockReturnValue(load.promise);
    const store = createStore();
    const element = await mount(store, 8);

    store.setSortKey("PRICE");
    render(element, 8, "loading");
    await flush();
    store.settle();
    render(element, 4, "idle");
    store.setSortKey("TITLE");
    render(element, 4, "loading");
    expect(events).toHaveLength(0);

    load.resolve(fakeStandardEvents);
    await flush();

    expect(events.map((event) => event.collection.productsCount)).toEqual([8, 4]);
    await expect(eventAt(0).promise).resolves.toEqual({ productsCount: 4 });

    store.settle();
    render(element, 2, "idle");
    await expect(eventAt(1).promise).resolves.toEqual({ productsCount: 2 });
  });

  it.each([
    ["has no event class", {}],
    [
      "can't create the promise",
      {
        CollectionUpdateEvent: class extends Event {
          static createPromise(): never {
            throw new Error("createPromise failed");
          }
        },
      },
    ],
  ])("drops the update, but not the navigation, when the module %s", async (_name, module) => {
    importStandardEventsFromCDN.mockResolvedValue(module);
    const store = createStore();
    const onBrowseChange = vi.fn();
    store.setOnBrowseChange(onBrowseChange);
    await mount(store);

    store.setSortKey("PRICE");
    store.setSortKey("TITLE");

    expect(onBrowseChange).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(0);
  });
});
