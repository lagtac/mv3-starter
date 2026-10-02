import type { Store } from "../src/lib/messages.js";

// An in-memory stand-in for a chrome.storage area. Tests read `data` directly.
export interface FakeStore extends Store {
  data: Record<string, unknown>;
}

export function createFakeStore(initial: Record<string, unknown> = {}): FakeStore {
  const data: Record<string, unknown> = { ...initial };
  return {
    data,
    async get(key) {
      return key in data ? { [key]: data[key] } : {};
    },
    async set(items) {
      Object.assign(data, items);
    },
  };
}

// A store whose `get` or `set` rejects with `reason`.
export function createFailingStore(failOn: "get" | "set", reason: unknown): FakeStore {
  const store = createFakeStore();
  return {
    data: store.data,
    async get(key) {
      if (failOn === "get") throw reason;
      return store.get(key);
    },
    async set(items) {
      if (failOn === "set") throw reason;
      return store.set(items);
    },
  };
}
