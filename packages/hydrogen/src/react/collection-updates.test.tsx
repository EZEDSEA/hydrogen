// @vitest-environment happy-dom
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { CollectionActions } from "../core/collection";
import {
  COLLECTION_UPDATES_TAG_NAME,
  defineCollectionUpdates,
  type CollectionUpdatesElement,
} from "../core/collection/collection-updates";
import { assert } from "../core/test-utils";
import { CollectionProvider, useCollectionActions } from "./collection";
import { CollectionUpdates } from "./collection-updates";

type UpdateEvent = Event & {
  collection: { productsCount: number };
  promise: Promise<{ productsCount: number }>;
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

function page(urlSearch: string, dataSearch: string, productsCount: number) {
  return createElement(
    CollectionProvider,
    { data: { handle: "shirts", dataSearch }, urlSearch, onChange: () => {} },
    createElement(
      CollectionUpdates,
      { collection: { id: null, handle: "shirts" }, productsCount, className: "layout" },
      createElement(Controls),
    ),
  );
}

function getElement(container: HTMLElement) {
  const element = container.querySelector<CollectionUpdatesElement>(COLLECTION_UPDATES_TAG_NAME);
  assert(element, "expected a collection updates element");
  return element;
}

const events: UpdateEvent[] = [];
const record = (event: Event) => events.push(event as UpdateEvent);
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe("CollectionUpdates", () => {
  beforeAll(() => {
    defineCollectionUpdates();
  });

  afterEach(() => {
    document.removeEventListener("shopify:collection:update", record);
    events.length = 0;
    actions = undefined;
  });

  it("throws outside a CollectionProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      render(
        createElement(CollectionUpdates, {
          collection: { id: null, handle: "all" },
          productsCount: 1,
        }),
      ),
    ).toThrow("CollectionUpdates must be used inside a <CollectionProvider>.");
    vi.restoreAllMocks();
  });

  it("sets the provider's store, so a sort change sends an update that resolves with the new count", async () => {
    document.addEventListener("shopify:collection:update", record);
    const { container, rerender } = render(page("", "", 8));
    await flush();
    const element = getElement(container);

    expect(element.getAttribute("class")).toBe("layout");
    expect(element.store?.getState().handle).toBe("shirts");

    act(() => getActions().setSortKey("PRICE"));
    expect(events.map((event) => event.collection.productsCount)).toEqual([8]);

    // The router moves to the new URL first, then the loader data arrives.
    rerender(page("sort_by=price-ascending", "", 8));
    rerender(page("sort_by=price-ascending", "sort_by=price-ascending", 3));

    const [event] = events;
    assert(event, "expected an update event");
    await expect(event.promise).resolves.toEqual({ productsCount: 3 });
  });

  it("resolves both updates when a filter is turned on and off before the URL changes", async () => {
    document.addEventListener("shopify:collection:update", record);
    render(page("", "", 8));
    await flush();

    act(() => getActions().toggleFilter({ available: true }));
    act(() => getActions().toggleFilter({ available: true }));

    expect(events).toHaveLength(2);
    await expect(Promise.all(events.map((event) => event.promise))).resolves.toEqual([
      { productsCount: 8 },
      { productsCount: 8 },
    ]);
  });

  it("resolves both updates with the current count when a filter is turned on and off in one step", async () => {
    document.addEventListener("shopify:collection:update", record);
    const { container } = render(page("", "", 8));
    await flush();
    const setAttribute = vi.spyOn(getElement(container), "setAttribute");

    act(() => {
      getActions().toggleFilter({ available: true });
      getActions().toggleFilter({ available: true });
    });

    expect(events).toHaveLength(2);
    await expect(Promise.all(events.map((event) => event.promise))).resolves.toEqual([
      { productsCount: 8 },
      { productsCount: 8 },
    ]);
    // The store was idle again before React rendered, so the payload didn't change.
    expect(setAttribute).not.toHaveBeenCalled();
  });
});
