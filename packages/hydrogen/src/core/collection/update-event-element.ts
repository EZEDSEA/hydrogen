import type * as StandardEvents from "../../../vendor/standard-events";
import { importStandardEventsFromCDN } from "../shopify-scripts/standard-events";
import type { CollectionStore } from "./collection";
import type { CollectionState } from "./state";

// The update event classes of the Standard Events module. An interface keeps the docs build from
// printing the absolute path of the module.
interface StandardEventsModule extends Pick<
  typeof StandardEvents,
  Extract<keyof typeof StandardEvents, `${string}UpdateEvent`>
> {}

type Settlers<Result> = {
  resolve(value: Result): void;
  reject(reason?: unknown): void;
};

/** A Standard Events update event class, such as `CollectionUpdateEvent`. */
interface UpdateEventClass<EventPayload, Result> {
  new (payload: EventPayload & { promise: Promise<Result> }): Event;
  createPromise(): { promise: Promise<Result> } & Settlers<Result>;
}

/** The part of an update element's JSON payload that every update element reads. */
interface UpdateElementPayload {
  /** The store status that the page rendered with the payload. */
  status: CollectionState["status"];
}

/**
 * Describes an update element, such as `shopify-collection-updates`.
 *
 * @internal
 */
export interface UpdateEventOptions<Payload extends UpdateElementPayload, EventPayload, Result> {
  /** Attribute with the element's JSON payload, such as `collection-update-payload`. */
  payloadAttribute: string;
  /** Returns the event class from the Standard Events module. */
  getEventClass(module: StandardEventsModule): UpdateEventClass<EventPayload, Result>;
  /** Returns the page identity, such as the collection handle. A new key aborts pending updates. */
  getKey(payload: Payload): unknown;
  /** Returns the value that resolves the update promises, such as `{ productsCount }`. */
  getResult(payload: Payload): Result;
  /** Returns the event payload without the promise. The payload still has the result before the change. */
  createEventPayload(payload: Payload, state: CollectionState): EventPayload;
  /** Message of the `AbortError` that rejects pending updates. */
  abortMessage: string;
}

/** The property of an update element. */
interface UpdateEventElement {
  store: CollectionStore | null;
}

/**
 * Registers an update element, such as the one for `shopify:collection:update`, in the browser. Does
 * nothing on the server or when the tag is already registered.
 *
 * While it is connected, the element listens to the collection store in its `store` property. For
 * each filter or sort change from a store method, it sends one event right away, with the result
 * from its payload attribute: the result before the change. The page renders the payload again with
 * the store status. The first payload with the `idle` status resolves the pending promises with its
 * result, so the result always comes from a render after the store settled. When the store settles
 * in the same step as the change, no new results load and the page may render nothing new, so the
 * element resolves right away with the result in its current payload. A new key, a new store, and a
 * disconnect reject pending promises with an `AbortError`.
 *
 * @internal
 */
export function defineUpdateEventElement<
  Payload extends UpdateElementPayload,
  EventPayload,
  Result,
>(tagName: string, options: UpdateEventOptions<Payload, EventPayload, Result>): void {
  if (typeof customElements === "undefined" || customElements.get(tagName)) return;
  customElements.define(tagName, createUpdateEventElement(options));
}

function createUpdateEventElement<Payload extends UpdateElementPayload, EventPayload, Result>(
  options: UpdateEventOptions<Payload, EventPayload, Result>,
): new () => HTMLElement & UpdateEventElement {
  return class extends HTMLElement implements UpdateEventElement {
    static observedAttributes = [options.payloadAttribute];

    #store: CollectionStore | null = null;
    #unsubscribe: (() => void) | undefined;
    #module: StandardEventsModule | undefined;
    #loading: Promise<void> | undefined;
    // Changes that wait for the Standard Events module, with the result if the page settled first.
    #queue: { payload: EventPayload; result?: Result }[] = [];
    // Promises of sent events that wait for the page to render the new results.
    #pending: Settlers<Result>[] = [];
    // Set from a change until the next microtask. A settle in that time loaded no new results.
    #sameStep: object | null = null;

    get store(): CollectionStore | null {
      return this.#store;
    }

    set store(store: CollectionStore | null) {
      if (store === this.#store) return;
      this.#disconnectStore();
      this.#store = store;
      if (this.isConnected) this.#connectStore();
    }

    connectedCallback() {
      // A framework can set `store` before the class is defined. The value then sits on the
      // element and hides the setter.
      if (Object.hasOwn(this, "store")) {
        const { store } = this;
        Reflect.deleteProperty(this, "store");
        this.store = store ?? null;
      }
      this.#connectStore();
    }

    disconnectedCallback() {
      this.#disconnectStore();
    }

    attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null) {
      // Updates for the previous page never finish.
      const { getKey } = options;
      if (oldValue !== null && !Object.is(parse(oldValue, getKey), parse(newValue, getKey))) {
        this.#abort();
      }
      const result = parse(newValue, (payload: Payload) =>
        payload.status === "idle" ? options.getResult(payload) : undefined,
      );
      if (result !== undefined) this.#settle(result);
    }

    #connectStore() {
      const store = this.#store;
      if (!store || this.#unsubscribe) return;
      void this.#load();
      const unsubscribeChange = store.subscribeBrowseChange((state) => this.#change(state));
      const unsubscribeStatus = store.subscribe(({ status }) => {
        if (status === "idle" && this.#sameStep) this.#settleFromPayload();
      });
      this.#unsubscribe = () => {
        unsubscribeChange();
        unsubscribeStatus();
      };
    }

    #disconnectStore() {
      this.#unsubscribe?.();
      this.#unsubscribe = undefined;
      this.#abort();
    }

    #change(state: CollectionState) {
      const payload = parse(this.getAttribute(options.payloadAttribute), (current: Payload) =>
        options.createEventPayload(current, state),
      );
      if (payload === undefined) return;
      const step = {};
      this.#sameStep = step;
      queueMicrotask(() => {
        if (this.#sameStep === step) this.#sameStep = null;
      });
      this.#queue.push({ payload });
      if (this.#module) this.#send();
      else void this.#load().then(() => this.#send());
    }

    #load = () =>
      (this.#loading ??= importStandardEventsFromCDN().then(
        (loaded) => {
          this.#module = loaded;
        },
        () => {},
      ));

    // A payload with the `idle` status comes from a render after the store settled, so its result
    // belongs to the new results.
    #settle(result: Result) {
      for (const { resolve } of this.#pending) resolve(result);
      this.#pending = [];
      for (const update of this.#queue) update.result ??= result;
    }

    // The page can render the same payload as before, which changes no attribute, so read the result
    // from the current payload.
    #settleFromPayload() {
      const result = parse(this.getAttribute(options.payloadAttribute), options.getResult);
      if (result !== undefined) this.#settle(result);
    }

    #send() {
      const loaded = this.#module;
      if (!loaded) return;
      for (const { payload, result } of this.#queue.splice(0)) {
        let event: Event;
        let settlers: Settlers<Result>;
        // A module without the event class, or with a different API, drops the update.
        try {
          const EventClass = options.getEventClass(loaded);
          const { promise, resolve, reject } = EventClass.createPromise();
          // Listeners still see the rejection. The empty handler keeps an AbortError without
          // listeners from being reported as an unhandled rejection.
          promise.catch(() => {});
          event = new EventClass({ ...payload, promise });
          settlers = { resolve, reject };
        } catch {
          continue;
        }
        if (result === undefined) this.#pending.push(settlers);
        else settlers.resolve(result);
        this.dispatchEvent(event);
      }
    }

    #abort() {
      for (const { reject } of this.#pending) {
        reject(new DOMException(options.abortMessage, "AbortError"));
      }
      this.#pending = [];
      this.#queue = [];
    }
  };
}

// Payloads that are missing or don't parse return undefined.
function parse<Payload, T>(value: string | null, read: (payload: Payload) => T): T | undefined {
  if (value === null) return undefined;
  try {
    return read(JSON.parse(value));
  } catch {
    return undefined;
  }
}
