export type Message =
  | { type: "page-seen" }
  | { type: "get-stats" }
  | { type: "reset-stats" };

export type Reply =
  | { ok: true; count: number }
  | { ok: false; error: string };

export interface Store {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}
