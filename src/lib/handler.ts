import type { Message, Reply, Store } from "./messages.js";

const COUNT_KEY = "pageCount";

function isMessage(msg: unknown): msg is Message {
  if (typeof msg !== "object" || msg === null) return false;
  const type = (msg as { type?: unknown }).type;
  return type === "page-seen" || type === "get-stats" || type === "reset-stats";
}

async function readCount(store: Store): Promise<number> {
  const items = await store.get(COUNT_KEY);
  const value = items[COUNT_KEY];
  return typeof value === "number" ? value : 0;
}

export async function handleMessage(msg: unknown, store: Store): Promise<Reply> {
  if (!isMessage(msg)) return { ok: false, error: "unknown message" };
  try {
    switch (msg.type) {
      case "page-seen": {
        const count = (await readCount(store)) + 1;
        await store.set({ [COUNT_KEY]: count });
        return { ok: true, count };
      }
      case "get-stats":
        return { ok: true, count: await readCount(store) };
      case "reset-stats":
        await store.set({ [COUNT_KEY]: 0 });
        return { ok: true, count: 0 };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
