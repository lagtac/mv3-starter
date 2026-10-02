import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../src/lib/handler.js";
import { createFailingStore, createFakeStore } from "./fakes.js";

test("an empty store gives a count of 0", async () => {
  assert.deepEqual(await handleMessage({ type: "get-stats" }, createFakeStore()), { ok: true, count: 0 });
});

test("page-seen adds 1 each time", async () => {
  const store = createFakeStore();
  assert.deepEqual(await handleMessage({ type: "page-seen" }, store), { ok: true, count: 1 });
  assert.deepEqual(await handleMessage({ type: "page-seen" }, store), { ok: true, count: 2 });
  assert.equal(store.data.pageCount, 2);
});

test("reset-stats sets the count to 0", async () => {
  const store = createFakeStore();
  await handleMessage({ type: "page-seen" }, store);
  await handleMessage({ type: "page-seen" }, store);
  assert.deepEqual(await handleMessage({ type: "reset-stats" }, store), { ok: true, count: 0 });
  assert.deepEqual(await handleMessage({ type: "get-stats" }, store), { ok: true, count: 0 });
});

test("a malformed message gets the error reply", async () => {
  for (const msg of [{ type: "nope" }, null, "page-seen", undefined, {}, { type: 42 }, []]) {
    assert.deepEqual(
      await handleMessage(msg, createFakeStore()),
      { ok: false, error: "unknown message" },
      `input: ${JSON.stringify(msg)}`,
    );
  }
});

test("a non-number stored value counts as 0", async () => {
  for (const stored of ["5", null, { n: 1 }]) {
    const store = createFakeStore({ pageCount: stored });
    assert.deepEqual(await handleMessage({ type: "get-stats" }, store), { ok: true, count: 0 });
    assert.deepEqual(await handleMessage({ type: "page-seen" }, store), { ok: true, count: 1 });
  }
});

test("a failing store.get gives an error reply, and handleMessage resolves", async () => {
  const reply = await handleMessage({ type: "get-stats" }, createFailingStore("get", new Error("read failed")));
  assert.deepEqual(reply, { ok: false, error: "read failed" });
});

test("a failing store.set gives an error reply", async () => {
  const reply = await handleMessage({ type: "page-seen" }, createFailingStore("set", new Error("write failed")));
  assert.deepEqual(reply, { ok: false, error: "write failed" });
});

test("a rejection with a non-Error value uses its text", async () => {
  const reply = await handleMessage({ type: "reset-stats" }, createFailingStore("set", "plain text"));
  assert.deepEqual(reply, { ok: false, error: "plain text" });
});
