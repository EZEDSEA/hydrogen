/** Mirrors a CDN update event: a bubbling event that carries the payload fields. */
function createFakeUpdateEvent(type: string) {
  return class FakeUpdateEvent extends Event {
    static createPromise() {
      return Promise.withResolvers<unknown>();
    }

    constructor(payload: Record<string, unknown>) {
      super(type, { bubbles: true });
      Object.assign(this, payload);
    }
  };
}

/**
 * The update events of a Standard Events module, for a mocked `importStandardEventsFromCDN`. In a
 * `vi.mock` factory, load it with `await import`.
 */
export const fakeStandardEvents = {
  CollectionUpdateEvent: createFakeUpdateEvent("shopify:collection:update"),
};
