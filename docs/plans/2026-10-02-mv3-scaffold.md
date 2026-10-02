# MV3 extension scaffold Implementation Plan

**Status:** planned, 2026-10-02. Plan for the MV3 scaffold spec, reviewed and handed to the code stage.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The tasks build on each other (shared types, shared fakes, one growing `build.test.ts`), and each is small. The project's review rules in `~/.claude/CLAUDE.md` replace the skill's own reviews: no per-task reviewer, no final review pass. After each task, read `git diff` for the test files the task touched, and stop if an assertion was removed or weakened. The end-of-branch reviews run in a later session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chromium-only Manifest V3 extension (service worker, content script, popup, options page) compiled by `tsc` alone, with `node:test` unit tests and a check of the real `dist/` output.

**Architecture:** All logic sits in two pure modules, `src/lib/handler.ts` (the page counter) and `src/lib/settings.ts` (the greeting). Both take a `Store`, so tests pass an in-memory fake and Chrome passes `chrome.storage.session` or `chrome.storage.sync`. The four extension parts are thin wiring. `tsc` compiles `src/` to `dist/`, and a small Node script copies `manifest.json`, `.html` and `.css` files beside the output.

**Tech Stack:** TypeScript 7 (`tsc`), `@types/chrome`, `@types/node`, Node 22 `node:test`, Chrome MV3.

**Spec:** `docs/plans/2026-10-02-mv3-scaffold-spec.md`. Read it first. Its review is `docs/plans/2026-10-02-mv3-scaffold-spec-review.md`.

**Work type:** `feat`. Branch `feat/mv3-scaffold`, worktree `.claude/worktrees/mv3-scaffold`.

## Global Constraints

- Three dev dependencies only, exactly: `typescript@^7.0.2`, `@types/chrome@^0.3.4`, `@types/node@^22.20.5`. No runtime dependencies. Any other package is a gate: stop and ask.
- Node 22 (22.17.0 is installed). Chromium only; no Firefox code.
- `tsconfig.json`: `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"target": "ES2022"`, `"lib": ["ES2022", "DOM"]`, `"types": ["chrome"]`, `"strict": true`, `"verbatimModuleSyntax": true`, `"moduleDetection": "legacy"`, `"rootDir": "src"`, `"outDir": "dist"`. `package.json` has `"type": "module"`.
- Every relative import in `src/` ends in `.js`.
- `src/content.ts` has no top-level `import` or `export`, not even `import type`. It uses inline `import("./lib/messages.js").X` types.
- Every `<script>` in an HTML page has `type="module"`.
- Storage keys: `"pageCount"` in `chrome.storage.session`; `"settings"` in `chrome.storage.sync`.
- `handleMessage` never rejects. Unknown input replies `{ ok: false, error: "unknown message" }`.
- Exact UI and error texts: `"Pages seen this session: N"`, `"Background not reachable"`, `"Error: "` + text, `"Saved"`, `"Could not save: "` + text, `"Greeting cannot be empty"`, `"Greeting must be at most 100 characters"`.
- `npm test` = `npm run build && tsc -p tsconfig.test.json && node --test ".test-build/test/**/*.test.js"`. It must pass at every commit.
- Commit scopes: `manifest`, `background`, `content`, `popup`, `options`, `lib`, `build`, `test`, `docs`.

## Review Focus

These inputs are implied by the spec but not named in its test list. Each one has a test in the task that owns the code.

1. A message that is an object but not a valid message: `{}`, `{ type: 42 }`, `[]`, `undefined`. Expected: the `"unknown message"` reply. Test: Task 1, "a malformed message gets the error reply".
2. `store.set` rejects (the spec tests only `get`). Expected: an error reply, no rejection. Test: Task 1, "a failing store.set gives an error reply".
3. A storage call rejects with a value that is not an `Error`. Expected: the reply's `error` is that value as text. Test: Task 1, "a rejection with a non-Error value uses its text".
4. Saved settings whose greeting is a string but fails `validateGreeting` (empty, whitespace-only, over 100 characters). Expected: `loadSettings` returns the defaults. This plan reads "not a valid `Settings`" in the spec as "fails the same check `saveSettings` uses". Test: Task 2, "a saved value that is not valid Settings gives the defaults".
5. A greeting with spaces around it, 100 characters after trimming. Expected: valid, and saved trimmed. Test: Task 2, "validateGreeting checks the trimmed text" and "save then load returns the trimmed greeting".

---

## Context

The project directory holds only docs, `CLAUDE.md` and a Markdown lint config. There is no code yet. The spec (approved 2026-10-02) describes a small MV3 extension that is a learning playground. Its demo flow: the options page saves a greeting, the content script counts page loads, and the popup shows the greeting and the count. The count must survive a service worker restart.

The plan was checked in a scratch copy on 2026-10-02 with `typescript` 7.0.2, `@types/chrome` 0.3.4, `@types/node` 22.20.5 and Node 22.17.0. Every code block below compiled, and the final state passed 19 tests. Each red step below failed with the message it names.

Two small gaps in the spec are filled here:

- **`"include"` in the tsconfig files.** The spec does not list it. Without `"include": ["src"]`, `tsc -p tsconfig.json` also picks up `test/`, and `"rootDir": "src"` then fails. `tsconfig.test.json` sets `"include": ["src", "test"]`.
- **`.claude/worktrees/` in `.gitignore`.** This is an addition to the spec's list (`node_modules/`, `dist/`, `.test-build/`). The worktree for this branch lives inside the repo folder, and without the entry, `git status` in the main checkout lists it after the merge.

## Files to Modify/Create

All files are new.

| File | Task | Responsibility |
|---|---|---|
| `package.json`, `package-lock.json` | 1 (scripts change in 3) | Scripts, the three dev dependencies, `"type": "module"` |
| `tsconfig.json`, `tsconfig.test.json` | 1 | Compiler settings for `dist/` and for tests |
| `.gitignore` | 1 | `node_modules/`, `dist/`, `.test-build/`, `.claude/worktrees/` |
| `src/lib/messages.ts` | 1 | Shared types `Message`, `Reply`, `Store` |
| `src/lib/handler.ts` | 1 | `handleMessage(msg, store)`: all counter logic |
| `test/fakes.ts` | 1 | In-memory `Store` fakes, also used as the fake storage area |
| `test/handler.test.ts` | 1 | Handler tests |
| `src/lib/settings.ts` | 2 | `loadSettings`, `validateGreeting`, `saveSettings` |
| `test/settings.test.ts` | 2 | Settings tests |
| `manifest.json` | 3 (completed in 4) | The extension's entry points |
| `scripts/copy-static.mjs` | 3 | Copies `manifest.json`, `.html`, `.css` into `dist/` |
| `src/background.ts` | 3 | Service worker wiring |
| `src/content.ts` | 3 | Sends `page-seen` on page load |
| `test/build.test.ts` | 3 (grows in 4) | Checks the real `dist/` |
| `src/popup/popup.html`, `popup.css`, `popup.ts` | 4 | Popup page and the shared stylesheet |
| `src/options/options.html`, `options.ts` | 4 | Options page |

The spec names one fake store and one fake storage area in `test/fakes.ts`. Both parts use the same `Store` interface, so one factory, `createFakeStore`, serves both.

## Step-by-Step Implementation

Run every command from the worktree root, `.claude/worktrees/mv3-scaffold`. The code stage creates it with `git worktree add .claude/worktrees/mv3-scaffold -b feat/mv3-scaffold` from the main checkout.

Before every commit, read `git diff --cached`.

### Task 1: Toolchain, shared types and the counter handler

**Files:**

- Create: `package.json`, `package-lock.json` (by `npm install`), `tsconfig.json`, `tsconfig.test.json`, `.gitignore`
- Create: `src/lib/messages.ts`, `src/lib/handler.ts`
- Test: `test/fakes.ts`, `test/handler.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `src/lib/messages.ts`: `type Message`, `type Reply`, `interface Store { get(key: string): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void>; }`
  - `src/lib/handler.ts`: `handleMessage(msg: unknown, store: Store): Promise<Reply>`
  - `test/fakes.ts`: `interface FakeStore extends Store { data: Record<string, unknown> }`, `createFakeStore(initial?: Record<string, unknown>): FakeStore`, `createFailingStore(failOn: "get" | "set", reason: unknown): FakeStore`
  - npm scripts `build`, `watch`, `clean`, `test`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "play-ext",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "watch": "tsc -p tsconfig.json --watch",
    "clean": "node -e \"import('node:fs').then((fs) => { for (const d of ['dist', '.test-build']) fs.rmSync(d, { recursive: true, force: true }); })\"",
    "test": "npm run build && tsc -p tsconfig.test.json && node --test \".test-build/test/**/*.test.js\""
  }
}
```

The `build` script gains the copy step in Task 3. The test glob is quoted so Node expands it, not the shell.

- [ ] **Step 2: Install the three approved dev dependencies**

Run: `npm install --save-dev typescript@^7.0.2 @types/chrome@^0.3.4 @types/node@^22.20.5`

Expected: `package.json` gains a `devDependencies` block with exactly these three, and `package-lock.json` appears. Then `npx tsc --version` prints `Version 7.0.2` or a later 7.x.

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "types": ["chrome"],
    "strict": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "legacy",
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write `tsconfig.test.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": ".test-build",
    "types": ["chrome", "node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 5: Write `.gitignore`**

```gitignore
node_modules/
dist/
.test-build/
.claude/worktrees/
```

- [ ] **Step 6: Write `src/lib/messages.ts`**

```ts
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
```

- [ ] **Step 7: Write a stub `src/lib/handler.ts` with the final signature**

The stub lets the test file compile, so the red step fails on assertions, not on a missing module.

```ts
import type { Reply, Store } from "./messages.js";

export async function handleMessage(_msg: unknown, _store: Store): Promise<Reply> {
  return { ok: false, error: "not implemented" };
}
```

- [ ] **Step 8: Write `test/fakes.ts`**

```ts
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
```

- [ ] **Step 9: Write the failing test `test/handler.test.ts`**

```ts
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
```

- [ ] **Step 10: Run the tests and see them fail**

Run: `npm test`

Expected: both `tsc` runs succeed. `node --test` reports `# fail 8`, and each failure shows the stub's `error: 'not implemented'` against the expected value.

- [ ] **Step 11: Replace `src/lib/handler.ts` with the real implementation**

```ts
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
```

- [ ] **Step 12: Run the tests and see them pass**

Run: `npm test`

Expected: `# pass 8`, `# fail 0`.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.test.json .gitignore src/lib/messages.ts src/lib/handler.ts test/fakes.ts test/handler.test.ts
git commit -m "feat(lib): add toolchain, message types and the counter handler"
```

### Task 2: Settings module

**Files:**

- Create: `src/lib/settings.ts`
- Test: `test/settings.test.ts`

**Interfaces:**

- Consumes: `Store` from `src/lib/messages.ts`; `createFakeStore` from `test/fakes.ts`.
- Produces (`src/lib/settings.ts`):
  - `interface Settings { greeting: string }`
  - `const DEFAULT_SETTINGS: Settings` = `{ greeting: "Hello" }`
  - `const MAX_GREETING_LENGTH` = `100`
  - `loadSettings(area: Store): Promise<Settings>`
  - `validateGreeting(text: string): string | null` (error text, or `null` when valid)
  - `saveSettings(area: Store, settings: Settings): Promise<void>` (rejects on an invalid greeting)

- [ ] **Step 1: Write a stub `src/lib/settings.ts` with the final signatures**

```ts
import type { Store } from "./messages.js";

export interface Settings {
  greeting: string;
}

export const DEFAULT_SETTINGS: Settings = { greeting: "Hello" };
export const MAX_GREETING_LENGTH = 100;

export function validateGreeting(_text: string): string | null {
  return null;
}

export async function loadSettings(_area: Store): Promise<Settings> {
  return { greeting: "" };
}

export async function saveSettings(_area: Store, _settings: Settings): Promise<void> {}
```

- [ ] **Step 2: Write the failing test `test/settings.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  MAX_GREETING_LENGTH,
  loadSettings,
  saveSettings,
  validateGreeting,
} from "../src/lib/settings.js";
import { createFakeStore } from "./fakes.js";

test("nothing saved gives the defaults", async () => {
  assert.deepEqual(await loadSettings(createFakeStore()), DEFAULT_SETTINGS);
});

test("a saved value that is not valid Settings gives the defaults", async () => {
  for (const saved of ["Hi", null, {}, { greeting: 7 }, { greeting: "  " }, { greeting: "x".repeat(101) }]) {
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
```

- [ ] **Step 3: Run the tests and see them fail**

Run: `npm test`

Expected: `# pass 8`, `# fail 5`. All five settings tests fail on assertions, for example `greeting: ''` against `'Hello'`, and "Missing expected rejection". The 8 handler tests still pass.

- [ ] **Step 4: Replace `src/lib/settings.ts` with the real implementation**

```ts
import type { Store } from "./messages.js";

export interface Settings {
  greeting: string;
}

export const DEFAULT_SETTINGS: Settings = { greeting: "Hello" };
export const MAX_GREETING_LENGTH = 100;

const SETTINGS_KEY = "settings";

export function validateGreeting(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return "Greeting cannot be empty";
  if (trimmed.length > MAX_GREETING_LENGTH) {
    return `Greeting must be at most ${MAX_GREETING_LENGTH} characters`;
  }
  return null;
}

export async function loadSettings(area: Store): Promise<Settings> {
  const items = await area.get(SETTINGS_KEY);
  const saved = items[SETTINGS_KEY];
  if (typeof saved !== "object" || saved === null) return DEFAULT_SETTINGS;
  const greeting = (saved as { greeting?: unknown }).greeting;
  if (typeof greeting !== "string" || validateGreeting(greeting) !== null) return DEFAULT_SETTINGS;
  return { greeting: greeting.trim() };
}

export async function saveSettings(area: Store, settings: Settings): Promise<void> {
  const error = validateGreeting(settings.greeting);
  if (error !== null) throw new Error(error);
  await area.set({ [SETTINGS_KEY]: { greeting: settings.greeting.trim() } });
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `npm test`

Expected: `# pass 13`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/settings.ts test/settings.test.ts
git commit -m "feat(lib): add greeting settings with validation"
```

### Task 3: Build output, service worker and content script

**Files:**

- Create: `manifest.json` (without the popup and options page for now), `scripts/copy-static.mjs`
- Create: `src/background.ts`, `src/content.ts`
- Modify: `package.json` (the `build` script)
- Test: `test/build.test.ts`

**Interfaces:**

- Consumes: `handleMessage` from `src/lib/handler.ts`; type `Message` from `src/lib/messages.ts` (inline type only, in `content.ts`).
- Produces:
  - `dist/background.js`, `dist/content.js`, `dist/manifest.json` from `npm run build`.
  - In `test/build.test.ts`: helpers `dist` (absolute path of `dist/`), `readDist(path: string): string`, `interface Manifest`, `readManifest(): Manifest`. Task 4 adds tests to this file and uses these helpers.

- [ ] **Step 1: Change the `build` script in `package.json`**

Replace the `"build"` line with:

```json
    "build": "tsc -p tsconfig.json && node scripts/copy-static.mjs",
```

- [ ] **Step 2: Write `scripts/copy-static.mjs`**

```js
// Copies manifest.json and every .html and .css file under src/ into dist/.
// tsc compiles only the .ts files, so the build runs this after it.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const dist = join(root, "dist");

function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

copy(join(root, "manifest.json"), join(dist, "manifest.json"));

for (const entry of readdirSync(src, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !/\.(html|css)$/.test(entry.name)) continue;
  const from = join(entry.parentPath, entry.name);
  copy(from, join(dist, relative(src, from)));
}
```

- [ ] **Step 3: Write `manifest.json` without the popup and the options page**

Task 4 adds `action` and `options_page`, together with the pages they name.

```json
{
  "manifest_version": 3,
  "name": "Play Ext",
  "version": "0.1.0",
  "description": "A Manifest V3 learning playground.",
  "permissions": ["storage"],
  "background": { "service_worker": "background.js", "type": "module" },
  "content_scripts": [
    { "matches": ["https://*/*"], "js": ["content.js"], "run_at": "document_idle" }
  ]
}
```

- [ ] **Step 4: Write the failing test `test/build.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// This file runs from .test-build/test/, so the real build output is two levels up.
const dist = fileURLToPath(new URL("../../dist/", import.meta.url));

function readDist(path: string): string {
  const full = join(dist, path);
  assert.ok(existsSync(full), `dist/${path} is missing`);
  return readFileSync(full, "utf8");
}

interface Manifest {
  background?: { service_worker?: string };
  action?: { default_popup?: string };
  options_page?: string;
  content_scripts?: { js?: string[] }[];
}

function readManifest(): Manifest {
  return JSON.parse(readDist("manifest.json")) as Manifest;
}

test("every file named in the manifest exists in dist/", () => {
  const manifest = readManifest();
  const files = [
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    manifest.options_page,
    ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? []),
  ].filter((file): file is string => file !== undefined);
  assert.ok(files.length > 0, "the manifest names no files");
  for (const file of files) assert.ok(existsSync(join(dist, file)), `dist/${file} is missing`);
});

test("content.js has no module syntax", () => {
  const lines = readDist("content.js").split("\n");
  const moduleLines = lines.filter((line) => /^\s*(import|export)\b/.test(line));
  assert.deepEqual(moduleLines, [], "content.js runs as a classic script");
});
```

- [ ] **Step 5: Run the tests and see them fail**

Run: `npm test`

Expected: `# pass 13`, `# fail 2`, with the messages `dist/background.js is missing` and `dist/content.js is missing`.

- [ ] **Step 6: Write `src/background.ts`**

```ts
import { handleMessage } from "./lib/handler.js";

// Wiring only: all counter logic is in lib/handler.ts.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg, chrome.storage.session).then(sendResponse);
  return true; // sendResponse is called later, after the storage call.
});
```

- [ ] **Step 7: Write `src/content.ts`**

```ts
// A classic script: Chrome fails on any import or export here.
// So no top-level import, not even `import type`. See the spec, "The content script rule".
const pageSeen: import("./lib/messages.js").Message = { type: "page-seen" };

try {
  chrome.runtime.sendMessage(pageSeen).catch(() => {
    // "Extension context invalidated": the extension was reloaded. Nothing to do.
  });
} catch {
  // The same error, thrown before the call returns a promise.
}
```

- [ ] **Step 8: Run the tests and see them pass**

Run: `npm test`

Expected: `# pass 15`, `# fail 0`. Also check by eye that `dist/content.js` starts with `"use strict";` and has no `export {};` line.

- [ ] **Step 9: Prove the module-syntax check can fail**

This assertion had no natural red step, because `content.js` did not exist before Step 7.

Run: `printf '\nexport {};\n' >> src/content.ts && npm test`

Expected: `not ok` for "content.js has no module syntax", message `content.js runs as a classic script`, `# fail 1`.

Then remove the line by its text, not its position, so a missing final newline cannot take the closing brace with it: `sed -i '/^export {};$/d' src/content.ts`. Run `npm test` again. Expected: `# pass 15`, `# fail 0`. Check that `grep -c '^export' src/content.ts` prints `0`.

- [ ] **Step 10: Commit**

```bash
git add package.json manifest.json scripts/copy-static.mjs src/background.ts src/content.ts test/build.test.ts
git commit -m "feat(background): add manifest, build copy step, service worker and content script"
```

### Task 4: Popup and options page

**Files:**

- Create: `src/popup/popup.html`, `src/popup/popup.css`, `src/popup/popup.ts`
- Create: `src/options/options.html`, `src/options/options.ts`
- Modify: `manifest.json` (add `action` and `options_page`)
- Modify: `test/build.test.ts` (four more tests)

**Interfaces:**

- Consumes: `Message`, `Reply` from `src/lib/messages.ts`; `DEFAULT_SETTINGS`, `loadSettings`, `saveSettings`, `validateGreeting` from `src/lib/settings.ts`; `dist`, `readDist`, `readManifest` from `test/build.test.ts`.
- Produces: `dist/popup/popup.html`, `dist/popup/popup.css`, `dist/popup/popup.js`, `dist/options/options.html`, `dist/options/options.js`. The final `manifest.json`, equal to the spec's.

- [ ] **Step 1: Add the page tests to `test/build.test.ts`**

Change the `node:fs` and `node:path` imports at the top to:

```ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
```

Append to the end of the file:

```ts
function pages(): string[] {
  return readdirSync(dist, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".html"))
    .sort();
}

test("the manifest declares the popup and the options page", () => {
  const manifest = readManifest();
  assert.equal(manifest.action?.default_popup, "popup/popup.html");
  assert.equal(manifest.options_page, "options/options.html");
});

test("dist/ holds exactly the two pages", () => {
  assert.deepEqual(pages(), ["options/options.html", "popup/popup.html"]);
});

test("every script and stylesheet a page loads exists", () => {
  for (const page of pages()) {
    const html = readDist(page);
    const refs = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(refs.length > 0, `${page} loads no files`);
    for (const ref of refs) {
      // A page's paths are relative to its own folder: options.html links ../popup/popup.css.
      const target = join(dirname(page), ref);
      assert.ok(existsSync(join(dist, target)), `${page} points to missing dist/${target}`);
    }
  }
});

test("every page script is an ES module", () => {
  for (const page of pages()) {
    const scripts = readDist(page).match(/<script\b[^>]*>/g) ?? [];
    assert.ok(scripts.length > 0, `${page} has no script`);
    for (const tag of scripts) assert.match(tag, /\btype="module"/, `${page}: ${tag}`);
  }
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npm test`

Expected: `# fail 2`: "the manifest declares the popup and the options page" (`undefined` against `'popup/popup.html'`) and "dist/ holds exactly the two pages" (`[]` against the two paths). The last two new tests pass because there are no pages yet. The "exactly the two pages" test guards against that, and Steps 9 and 10 prove both checks can fail.

- [ ] **Step 3: Write the final `manifest.json`**

This is the spec's manifest, unchanged.

```json
{
  "manifest_version": 3,
  "name": "Play Ext",
  "version": "0.1.0",
  "description": "A Manifest V3 learning playground.",
  "permissions": ["storage"],
  "background": { "service_worker": "background.js", "type": "module" },
  "action": { "default_popup": "popup/popup.html" },
  "options_page": "options/options.html",
  "content_scripts": [
    { "matches": ["https://*/*"], "js": ["content.js"], "run_at": "document_idle" }
  ]
}
```

- [ ] **Step 4: Write `src/popup/popup.css`**

The one shared stylesheet. Only the `.popup` rule sets a width, so the options page fills its tab.

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

h1 {
  font-size: 1.25rem;
}

/* Only the popup gets a fixed width; the options page fills its tab. */
.popup {
  width: 260px;
}
```

- [ ] **Step 5: Write `src/popup/popup.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Play Ext</title>
  <link rel="stylesheet" href="popup.css">
  <script type="module" src="popup.js"></script>
</head>
<body class="popup">
  <h1 id="greeting"></h1>
  <p id="count"></p>
  <button id="reset" type="button">Reset</button>
</body>
</html>
```

A module script runs after the page is parsed, so `popup.js` finds the elements without a `DOMContentLoaded` handler.

- [ ] **Step 6: Write `src/popup/popup.ts`**

```ts
import type { Message, Reply } from "../lib/messages.js";
import { DEFAULT_SETTINGS, loadSettings } from "../lib/settings.js";

const greeting = document.querySelector<HTMLHeadingElement>("#greeting")!;
const count = document.querySelector<HTMLParagraphElement>("#count")!;
const reset = document.querySelector<HTMLButtonElement>("#reset")!;

async function send(message: Message): Promise<void> {
  let reply: Reply;
  try {
    reply = await chrome.runtime.sendMessage<Message, Reply>(message);
  } catch {
    count.textContent = "Background not reachable";
    return;
  }
  count.textContent = reply.ok ? `Pages seen this session: ${reply.count}` : `Error: ${reply.error}`;
}

reset.addEventListener("click", () => {
  void send({ type: "reset-stats" });
});

loadSettings(chrome.storage.sync)
  .catch(() => DEFAULT_SETTINGS)
  .then((settings) => {
    greeting.textContent = settings.greeting;
  });

void send({ type: "get-stats" });
```

The spec does not say what happens when `chrome.storage.sync` itself rejects on load. The popup then shows the default greeting, and adds no new text.

- [ ] **Step 7: Write `src/options/options.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Play Ext options</title>
  <link rel="stylesheet" href="../popup/popup.css">
  <script type="module" src="options.js"></script>
</head>
<body>
  <form id="form">
    <label for="greeting">Greeting</label>
    <input id="greeting" type="text" maxlength="100">
    <button type="submit">Save</button>
  </form>
  <p id="status" role="status"></p>
</body>
</html>
```

The `<form>` lets the Enter key save too. The handler calls `preventDefault`, so the page does not reload.

- [ ] **Step 8: Write `src/options/options.ts`**

> The end-of-branch fix round changed this file after the plan ran: a failed load now shows "Could not load: " and leaves the field empty. See Open Questions. The block below is the code as first written.

```ts
import { DEFAULT_SETTINGS, loadSettings, saveSettings, validateGreeting } from "../lib/settings.js";

const form = document.querySelector<HTMLFormElement>("#form")!;
const input = document.querySelector<HTMLInputElement>("#greeting")!;
const statusLine = document.querySelector<HTMLParagraphElement>("#status")!;

loadSettings(chrome.storage.sync)
  .catch(() => DEFAULT_SETTINGS)
  .then((settings) => {
    input.value = settings.greeting;
  });

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const error = validateGreeting(input.value);
  if (error !== null) {
    statusLine.textContent = error;
    return;
  }
  saveSettings(chrome.storage.sync, { greeting: input.value })
    .then(() => {
      statusLine.textContent = "Saved";
    })
    .catch((err: unknown) => {
      statusLine.textContent = `Could not save: ${err instanceof Error ? err.message : String(err)}`;
    });
});
```

The variable is `statusLine`, not `status`, because `window.status` is a DOM global.

- [ ] **Step 9: Run the tests and see them pass**

Run: `npm test`

Expected: `# pass 19`, `# fail 0`.

- [ ] **Step 10: Prove the module-type check can fail**

Run: `sed -i 's/<script type="module" src="popup.js">/<script src="popup.js">/' src/popup/popup.html && npm test`

Expected: `not ok` for "every page script is an ES module", message `popup/popup.html: <script src="popup.js">`, `# fail 1`.

Then restore: `sed -i 's/<script src="popup.js">/<script type="module" src="popup.js">/' src/popup/popup.html`.

- [ ] **Step 11: Prove the missing-file check can fail**

Run: `sed -i 's#href="../popup/popup.css"#href="popup.css"#' src/options/options.html && npm run clean && npm test`

Expected: `not ok` for "every script and stylesheet a page loads exists", message `options/options.html points to missing dist/options/popup.css`, `# fail 1`.

Then restore: `sed -i 's#href="popup.css"#href="../popup/popup.css"#' src/options/options.html`. Run `npm test`. Expected: `# pass 19`, `# fail 0`.

- [ ] **Step 12: Commit**

```bash
git add manifest.json src/popup src/options test/build.test.ts
git commit -m "feat(popup): add popup and options page"
```

## Trade-Offs / Alternatives Considered

The spec settles the main choices: `tsc` only, Chromium only, `storage.session` for the counter, and `sendResponse` with `return true`. This plan adds these smaller ones:

- **Stub first, then the real module (red step).**
  - Stub: the test file compiles, and the red step fails on real assertions. Costs one extra small file write per task.
  - No stub: `tsc -p tsconfig.test.json` fails with "Cannot find module", so `node --test` never runs. That is not a failure for the right reason.
  - **Chosen:** stub.
- **One fake factory vs a fake store plus a separate fake area.** Both parts use the same `Store` interface, so a second factory would be a copy. **Chosen:** one `createFakeStore`, plus `createFailingStore` for rejections.
- **Manifest in two steps.**
  - Full manifest in Task 3: the "every file named in the manifest exists" test fails until Task 4 adds the pages, so Task 3 cannot commit green.
  - **Chosen:** Task 3 writes the manifest without `action` and `options_page`. Task 4 adds them with the pages and a test that pins both values.
- **Copy-script folder walk vs a fixed file list.** A fixed list must change with every new page. `readdirSync` with `recursive: true` (Node 20+) copies any `.html` or `.css` file under `src/`. **Chosen:** the folder walk.
- **`clean` command.** `rm -rf` is not portable, and `rimraf` would be a fourth dependency. **Chosen:** `node -e` with `fs.rmSync`. It was run once under `"type": "module"` and removed both folders.

## Dependencies

- `typescript@^7.0.2`, `@types/chrome@^0.3.4`, `@types/node@^22.20.5`, as dev dependencies. All three are approved in the spec (D6 and "Dependencies"). No runtime dependencies.
- Node 22 on the developer machine. 22.17.0 is installed and supports `readdirSync` with `recursive`, `Dirent.parentPath` and the `node --test` glob. The end-of-branch fix round added `"engines": { "node": ">=22" }` to `package.json`, so npm warns on an older Node. Task 1's `package.json` block does not show it.
- A Chromium browser for the manual demo flow.
- No environment variables. No config outside the repo.

## Risk

- **TypeScript 7 behaviour.** Checked in a scratch copy with 7.0.2 on 2026-10-02: the settings build, `content.js` has no `export {};`, and both storage areas type-check as `Store`. A later 7.x could change this. Detection: `npm test` fails at the first build. Fallback, per the spec: pin `typescript@^5`. That changes a dependency version, so it is a gate.
- **`export {};` in `content.js`.** Detection: `build.test.ts`, "content.js has no module syntax". Task 3, Step 9 proves the check fails when it should.
- **Lost increments.** Two `page-seen` messages handled at once can lose one increment. Known limit from the spec, accepted for a demo counter. Not a finding. The same race can undo a Reset: if `page-seen` reads 7, then Reset writes 0, then `page-seen` writes 8, the next popup shows 8. A fix would run `handleMessage` calls one at a time in `background.ts`.
- **Stale files in `dist/`.** `npm run build` does not delete `dist/` first. A file removed from `src/` stays in `dist/` until `npm run clean`. `build.test.ts` only checks that named files exist, so it does not catch a stale extra file. Known limit for a playground. Not a finding.
- **`npm run watch` does not copy HTML, CSS or the manifest.** Known limit from the spec. After editing those files, run `npm run build`.
- **Regex HTML checks.** `build.test.ts` reads attributes with regular expressions. They expect double-quoted attribute values, as the two pages use. A page written with single quotes or no quotes would escape the checks. Known limit; the project has two hand-written pages.
- **Values `chrome.storage` cannot hold.** `chrome.storage` stores JSON-like values. So `NaN` and `Infinity` cannot be the stored count, and the handler checks only `typeof value === "number"`. Not tested.
- **Untested UI wiring.** `popup.ts`, `options.ts` and `background.ts` have no unit tests, as the spec decides. Detection: the manual demo flow below.
- **The worktree inside the repo folder.** `.claude/worktrees/` is not ignored on `main` until this branch merges. While the worktree exists, `git status` in the main checkout lists `.claude/`. The plan's `.gitignore` fixes this after the merge.
- **`maxlength="100"` counts spaces.** The browser limits the raw text, but `validateGreeting` limits the trimmed text. A greeting with spaces around it, close to 100 characters, is cut short while typing. The spaces would be trimmed on save anyway. Known limit, kept by the user's choice at the end-of-branch review.
- **Stale files in `.test-build/`.** `npm test` does not delete `.test-build/` first. A renamed or deleted test file keeps its old compiled `.js`, which still matches the test glob and runs. No test file has been renamed. Detection: a test count that does not match the test files. Fix: `npm run clean`.
- **Popup with an empty reply.** `popup.ts` reads `reply.ok` without checking that `reply` exists. `background.ts` always replies, and a stopped service worker makes Chrome reject the call, which the popup already handles. Today's code never produces an empty reply.
- **No `sender` check in `background.ts`.** The manifest has no `externally_connectable`, so web pages cannot message the extension. Only `content.ts` sends, and it sends only `page-seen`. Known limit for a playground.
- **A slow settings load on the options page.** The load sets the field when it finishes, so text typed before then is replaced. The load takes milliseconds. Known limit.
- **A second injection of `content.ts`.** Its top-level `const pageSeen` is shared across the content-script context, so injecting the script twice into one frame throws. Nothing calls `chrome.scripting.executeScript` today.
- **The "no module syntax" check.** `build.test.ts` catches only lines that start with `import` or `export`. Top-level `await` or `import.meta` in `content.ts` would pass the check and still fail in Chrome. Today's `content.ts` has neither.
- **`DOM` types in the service worker.** `tsconfig.json` gives every file `"lib": ["ES2022", "DOM"]`, so `background.ts` could use `document` and still type-check, then throw at runtime. Today's `background.ts` uses no DOM API.
- **`DEFAULT_SETTINGS` is not frozen.** `loadSettings` returns the shared object, so a caller that changed the result would change every later fallback. No caller changes it today.
- **Reversibility.** Nothing is hard to reverse: no published extension, no user data that matters, no public API. Blast radius: the whole project is new, so there are no existing callers.

## Testing Strategy

- **Unit tests** (`node:test`, run by `npm test`):
  - `test/handler.test.ts`: 8 tests. Counting, reset, malformed input, non-number stored values, and `get` and `set` rejections.
  - `test/settings.test.ts`: 5 tests. Defaults, invalid saved values, trimming, the length limit, and rejection without a write.
- **End-to-end check of the public surface:** `test/build.test.ts`, 6 tests on the real `dist/`. Manifest files exist, `content.js` has no module syntax, the manifest names both pages, exactly two pages exist, every page reference resolves, and every page script is a module.
- **Red steps:** each task runs its new tests against a stub or a missing file first, with the expected failure written in the step. Three checks have no natural red step, so Task 3, Step 9 and Task 4, Steps 10 and 11 break them on purpose and restore them.
- **End-of-branch check (manual, by the user):** build, then "Load unpacked" `dist/` in `chrome://extensions`. Expect no errors. Then run the spec's "Demo flow" steps 1 to 5. The code stage cannot load an extension in Chrome, so the review stage asks the user to run this.

## Open Questions

None. Two readings of the spec are recorded above, not asked: "not a valid `Settings`" includes a greeting that fails `validateGreeting` (Review Focus 4), and a rejected settings load shows the defaults (Task 4, Step 6). The end-of-branch review changed this for the options page only: there a rejected load shows "Could not load: " and leaves the field empty, because the default in the field let Save overwrite the stored greeting. The user chose this on 2026-10-02. The popup keeps the defaults.
