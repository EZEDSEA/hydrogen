// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { defineComponent, h, type PropType } from "vue";

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
const Controls = defineComponent(() => {
  actions = useCollectionActions();
  return () => null;
});

function getActions() {
  assert(actions, "expected the collection actions");
  return actions;
}

type Loader = { term: string; dataSearch: string; totalCount: number };

const Page = defineComponent({
  props: {
    loader: { type: Object as PropType<Loader>, required: true },
    urlSearch: { type: String, required: true },
  },
  setup(props) {
    return () =>
      h(
        CollectionProvider,
        {
          data: { handle: `search:${props.loader.term}`, dataSearch: props.loader.dataSearch },
          urlSearch: props.urlSearch,
        },
        () =>
          h(SearchUpdates, { query: props.loader.term, totalCount: props.loader.totalCount }, () =>
            h(Controls),
          ),
      );
  },
});

const events: UpdateEvent[] = [];
const record = (event: Event) => events.push(event as UpdateEvent);

describe("Vue SearchUpdates", () => {
  beforeAll(() => {
    defineSearchUpdates();
  });

  afterEach(() => {
    document.removeEventListener("shopify:search:update", record);
    events.length = 0;
    actions = undefined;
    document.body.innerHTML = "";
  });

  it("throws outside a collection provider", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => mount(SearchUpdates, { props: { query: "shirt", totalCount: 1 } })).toThrow(
      "SearchUpdates must be used inside a <CollectionProvider>.",
    );
    vi.restoreAllMocks();
  });

  it("sets the provider's store and sends an update that resolves with the new total count", async () => {
    document.addEventListener("shopify:search:update", record);
    const wrapper = mount(Page, {
      props: {
        loader: { term: "shirt", dataSearch: "q=shirt", totalCount: 12 },
        urlSearch: "q=shirt",
      },
      attachTo: document.body,
    });
    await flushPromises();
    const element = wrapper.find(SEARCH_UPDATES_TAG_NAME).element as SearchUpdatesElement;

    expect(element.store?.getState().handle).toBe("search:shirt");

    getActions().setSortKey("PRICE");
    expect(events.map((event) => event.search)).toEqual([{ query: "shirt", sortKey: "PRICE" }]);

    // The router moves to the new URL in a later step.
    await flushPromises();
    const search = "q=shirt&sort_by=price-ascending";
    await wrapper.setProps({ urlSearch: search });
    await wrapper.setProps({ loader: { term: "shirt", dataSearch: search, totalCount: 7 } });

    const [event] = events;
    assert(event, "expected a search update event");
    await expect(event.promise).resolves.toEqual({ totalCount: 7 });
    wrapper.unmount();
  });
});
