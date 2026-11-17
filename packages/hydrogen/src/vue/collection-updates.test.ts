// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref, type PropType } from "vue";

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
const Controls = defineComponent(() => {
  actions = useCollectionActions();
  return () => null;
});

function getActions() {
  assert(actions, "expected the collection actions");
  return actions;
}

type Loader = { handle: string; dataSearch: string; productsCount: number };

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
          data: { handle: props.loader.handle, dataSearch: props.loader.dataSearch },
          urlSearch: props.urlSearch,
        },
        () =>
          h(
            CollectionUpdates,
            {
              collection: { id: null, handle: props.loader.handle },
              productsCount: props.loader.productsCount,
            },
            () => h(Controls),
          ),
      );
  },
});

const events: UpdateEvent[] = [];
const record = (event: Event) => events.push(event as UpdateEvent);

function eventAt(index: number): UpdateEvent {
  const event = events[index];
  assert(event, `expected update event ${index}`);
  return event;
}

describe("Vue CollectionUpdates", () => {
  beforeAll(() => {
    defineCollectionUpdates();
  });

  afterEach(() => {
    document.removeEventListener("shopify:collection:update", record);
    events.length = 0;
    actions = undefined;
    document.body.innerHTML = "";
  });

  it("throws outside a collection provider", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      mount(CollectionUpdates, {
        props: { collection: { id: null, handle: "all" }, productsCount: 1 },
      }),
    ).toThrow("CollectionUpdates must be used inside a <CollectionProvider>.");
    vi.restoreAllMocks();
  });

  it("sets the provider's store, sends an update, and follows a new store for a new collection", async () => {
    document.addEventListener("shopify:collection:update", record);
    const wrapper = mount(Page, {
      props: { loader: { handle: "shirts", dataSearch: "", productsCount: 8 }, urlSearch: "" },
      attachTo: document.body,
    });
    await flushPromises();
    const element = wrapper.find(COLLECTION_UPDATES_TAG_NAME).element as CollectionUpdatesElement;
    const shirts = element.store;

    expect(shirts?.getState().handle).toBe("shirts");

    getActions().setSortKey("PRICE");
    expect(events.map((event) => event.collection.productsCount)).toEqual([8]);

    // The router moves to the new URL in a later step. Then the provider settles the store before
    // the page renders the new count, so the element waits for the idle render.
    await flushPromises();
    await wrapper.setProps({ urlSearch: "sort_by=price-ascending" });
    await wrapper.setProps({
      loader: { handle: "shirts", dataSearch: "sort_by=price-ascending", productsCount: 3 },
    });

    const [event] = events;
    assert(event, "expected an update event");
    await expect(event.promise).resolves.toEqual({ productsCount: 3 });

    await wrapper.setProps({ loader: { handle: "pants", dataSearch: "", productsCount: 4 } });

    expect(element.store).not.toBe(shirts);
    expect(element.store?.getState().handle).toBe("pants");
    wrapper.unmount();
  });

  it("doesn't settle in the same step when the change handler moves the URL right away", async () => {
    document.addEventListener("shopify:collection:update", record);
    // Like the Nuxt example: the change handler sets the URL search right away, and the loader data
    // arrives later.
    const urlSearch = ref("");
    const loader = ref<Loader>({ handle: "shirts", dataSearch: "", productsCount: 8 });
    const RoutedPage = defineComponent(
      () => () =>
        h(
          CollectionProvider,
          {
            data: { handle: loader.value.handle, dataSearch: loader.value.dataSearch },
            urlSearch: urlSearch.value,
            onChange: (search: string) => (urlSearch.value = search.replace(/^\?/, "")),
          },
          () =>
            h(
              CollectionUpdates,
              {
                collection: { id: null, handle: "shirts" },
                productsCount: loader.value.productsCount,
              },
              () => h(Controls),
            ),
        ),
    );
    const wrapper = mount(RoutedPage, { attachTo: document.body });
    await flushPromises();
    const element = wrapper.find(COLLECTION_UPDATES_TAG_NAME).element as CollectionUpdatesElement;

    const statuses: string[] = [];
    element.store?.subscribe(({ status }) => statuses.push(status));
    getActions().setSortKey("PRICE");
    await nextTick();

    // The provider gets the new URL and a new `data` object with the old values in the same render.
    // It must not settle the store with the old data in between.
    expect(statuses).toEqual(["loading"]);

    loader.value = { handle: "shirts", dataSearch: "sort_by=price-ascending", productsCount: 3 };

    await expect(eventAt(0).promise).resolves.toEqual({ productsCount: 3 });
    wrapper.unmount();
  });
});
