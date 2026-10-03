import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  MAX_GREETING_LENGTH,
  saveSettings,
  validateGreeting,
} from "../src/lib/settings.js";
import { createFakeStore } from "./fakes.js";

test("nothing saved gives the defaults", async () => {
  assert.deepEqual(await loadSettings(createFakeStore()), DEFAULT_SETTINGS);
});

test("a saved value that is not valid Settings gives the defaults", async () => {
  for (const saved of [
    "Hi",
    null,
    {},
    { greeting: 7 },
    { greeting: "  " },
    { greeting: "x".repeat(101) },
  ]) {
    assert.deepEqual(
      await loadSettings(createFakeStore({ settings: saved })),
      DEFAULT_SETTINGS,
      `saved: ${JSON.stringify(saved)}`,
    );
  }
});

test("save then load returns the trimmed greeting", async () => {
  const area = createFakeStore();
  await saveSettings(area, { greeting: "  Hi there  " });
  assert.deepEqual(area.data.settings, { greeting: "Hi there" });
  assert.deepEqual(await loadSettings(area), { greeting: "Hi there" });
});

test("validateGreeting checks the trimmed text", () => {
  assert.equal(validateGreeting(""), "Greeting cannot be empty");
  assert.equal(validateGreeting("   "), "Greeting cannot be empty");
  assert.equal(validateGreeting("x".repeat(101)), "Greeting must be at most 100 characters");
  assert.equal(validateGreeting("x".repeat(MAX_GREETING_LENGTH)), null);
  assert.equal(validateGreeting(` ${"x".repeat(100)} `), null);
});

test("saveSettings rejects an invalid greeting and leaves storage unchanged", async () => {
  const area = createFakeStore({ settings: { greeting: "Old" } });
  await assert.rejects(saveSettings(area, { greeting: " " }), /Greeting cannot be empty/);
  await assert.rejects(saveSettings(area, { greeting: "x".repeat(101) }), /at most 100 characters/);
  assert.deepEqual(area.data, { settings: { greeting: "Old" } });
});
