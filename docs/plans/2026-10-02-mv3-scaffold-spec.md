# MV3 extension scaffold — spec

**Status:** approved, 2026-10-02. Spec for a TypeScript MV3 extension playground, revised after its review; approved by the user.

**Path:** architectural (new project), brainstormed without `my:architect` at the user's request.

## How to read this spec

Read in this order:

1. This spec: `docs/plans/2026-10-02-mv3-scaffold-spec.md`.
2. The spec review: `docs/plans/2026-10-02-mv3-scaffold-spec-review.md`.
3. The implementation plan, once written: `docs/plans/2026-10-02-mv3-scaffold.md`.

There is no architecture brief, roadmap or changelog yet. The project directory was empty when this spec was written.

External references used:

- Chrome Extensions, Manifest V3 overview: <https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3>
- Service worker lifecycle (why state must not live in variables): <https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle>
- Message passing: <https://developer.chrome.com/docs/extensions/develop/concepts/messaging>
- `chrome.storage` areas and limits: <https://developer.chrome.com/docs/extensions/reference/api/storage>
- Node test runner: <https://nodejs.org/docs/latest-v22.x/api/test.html>

## Goal

Build a small Manifest V3 (MV3) browser extension that serves as a learning playground. MV3 is the current Chrome extension format.

Success means:

1. `npm run build` produces a `dist/` folder.
2. "Load unpacked" in `chrome://extensions` accepts `dist/` with no errors.
3. All four extension parts work together in one demo flow (see "Demo flow").
4. `npm test` passes.

### What the user decided

| ID | Decision | Answer |
|---|---|---|
| D1 | Purpose | Learning playground. Small, easy to read, quick to reload. |
| D2 | Tooling | TypeScript compiled by `tsc` only. No bundler, no framework. |
| D3 | Browsers | Chromium only (Chrome, Edge, Brave). |
| D4 | Parts | Background service worker, popup, content script, options page. |
| D5 | Tests | Unit tests with `node:test`, plus a check of the real build output. No browser automation. |
| D6 | Test types | Tests are TypeScript. This needs `@types/node` (approved as a third dev dependency). |
| D7 | Storage failures | `handleMessage` never rejects; storage errors become `{ ok: false, error }`. The options page shows save failures. (After the spec review.) |
| D8 | Shared types | `Store` lives in `lib/messages.ts` with the other shared types. (After the spec review.) |
| D9 | Stylesheet | One shared stylesheet; the 260px width applies to the popup only. (After the spec review.) |
| D10 | UI drawing | No design canvas for this playground; the Visual Language table is enough. |

### Assumptions

- No icons. MV3 does not require them. Chrome shows a letter icon in their place.
- No Firefox support. Firefox has no extension service worker, so supporting it would change the manifest (see Trade-offs).
- The project becomes a git repository with `git init`, on branch `main`, before the spec commit.

## Architecture

### File layout

```text
play-ext/
  manifest.json              static; copied to dist/
  src/
    background.ts            service worker (ES module); wiring only
    content.ts               content script (classic script)
    popup/
      popup.html
      popup.css
      popup.ts
    options/
      options.html
      options.ts
    lib/
      messages.ts            shared types: Message, Reply, Store
      handler.ts             handleMessage(msg, store): all counter logic
      settings.ts            loadSettings / saveSettings
  scripts/
    copy-static.mjs          copies manifest.json, *.html, *.css into dist/
  test/
    fakes.ts                 in-memory fake store and fake storage area
    handler.test.ts
    settings.test.ts
    build.test.ts
  tsconfig.json              src/ -> dist/
  tsconfig.test.json         src/ + test/ -> .test-build/
  package.json
  .gitignore                 node_modules/, dist/, .test-build/
```

### Build

`npm run build` runs two steps:

1. `tsc -p tsconfig.json` compiles `src/**/*.ts` to `dist/`, keeping the folder structure. So `src/popup/popup.ts` becomes `dist/popup/popup.js`.
2. `node scripts/copy-static.mjs` copies `manifest.json` and every `.html` and `.css` file under `src/` into `dist/`, with the same relative paths. It uses only the Node `fs` module.

`npm run watch` runs `tsc -p tsconfig.json --watch`. It does not re-copy static files. After editing HTML, CSS or the manifest, run `npm run build` again.

`npm run clean` deletes `dist/` and `.test-build/`.

### Compiler settings

`tsconfig.json`:

- `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`, with `"type": "module"` in `package.json`. This forces relative imports to end in `.js`. The browser needs those exact paths, because no bundler rewrites them.
- `"target": "ES2022"`, `"lib": ["ES2022", "DOM"]`, `"types": ["chrome"]`.
- `"strict": true`, `"verbatimModuleSyntax": true`. The second setting makes `tsc` keep each import exactly as written, minus type-only imports. So the output imports are the paths the browser loads.
- `"moduleDetection": "legacy"` (see next section).
- `"rootDir": "src"`, `"outDir": "dist"`.

`tsconfig.test.json` extends `tsconfig.json`. It sets `"rootDir": "."`, `"outDir": ".test-build"`, includes `src` and `test`, and sets `"types": ["chrome", "node"]`. Test output never goes into `dist/`, the folder loaded into Chrome.

### The content script rule

Chrome runs content scripts as classic scripts. A classic script fails on any `import` or `export` statement.

Two rules keep `content.js` free of module syntax:

1. `content.ts` has no top-level `import` or `export`, not even `import type`. It refers to shared types with inline type expressions, such as `import("./lib/messages.js").Message`.
2. `tsconfig.json` sets `"moduleDetection": "legacy"`. With this setting, `tsc` treats a file as a module only if it has a top-level `import` or `export`.

Both rules are needed. This was checked against `tsc` 7.0.2 on 2026-10-02:

| `moduleDetection` | `content.ts` style | Output ends with `export {};`? |
|---|---|---|
| `auto` or `force` | `import type` line | yes (breaks Chrome) |
| `auto` or `force` | inline `import(...)` type | yes (breaks Chrome) |
| `legacy` | `import type` line | yes (breaks Chrome) |
| `legacy` | inline `import(...)` type | no; output starts with `"use strict";` |

With `auto`, the cause is `"type": "module"` in `package.json`: `tsc` then treats every file as a module. The other source files all have imports, so `legacy` does not change them.

In other words, `content.ts` is written so that `tsc` treats it as a script, and the compiled file has no module syntax. `build.test.ts` checks the compiled file, so a mistake fails the tests.

### Page scripts are modules

The opposite rule holds for the popup and the options page. `popup.ts` and `options.ts` import from `lib/`, so their output is ES modules. Each HTML file must load its script with `<script type="module" src="...">`. A plain `<script src>` fails with a syntax error on the first `import`. `build.test.ts` checks this too.

### Manifest

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

## Components

### `lib/messages.ts`

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

Every message gets a `Reply`. The callers never need to guess the shape of an answer.

`messages.ts` holds every type that more than one part uses. `Store` lives here, so `handler.ts` and `settings.ts` both import it from one place and do not depend on each other. `messages.ts` contains types only, so it compiles to an empty module.

### `lib/handler.ts`

```ts
export async function handleMessage(msg: unknown, store: Store): Promise<Reply>;
```

- `handleMessage` never rejects. If `store.get` or `store.set` rejects, it replies `{ ok: false, error: <the error's message> }`. So `sendResponse` is always called.
- `chrome.storage.session` matches the `Store` interface, so `background.ts` passes it directly.
- The counter lives under the key `"pageCount"`. A missing or non-number value counts as 0.
- `page-seen` adds 1 and replies with the new count.
- `get-stats` replies with the current count.
- `reset-stats` sets the count to 0 and replies with 0.
- Any other input, including a non-object or an unknown `type`, replies `{ ok: false, error: "unknown message" }`.
- `msg` is typed `unknown`, because any extension page or content script can send anything.

The counter is in `chrome.storage.session`, not in a variable. Chrome stops an idle service worker after about 30 seconds, and a variable would reset to 0. `storage.session` keeps the value across service worker restarts. Chrome clears it when the browser closes, and when the extension is reloaded, updated or disabled. Showing this is one of the purposes of the demo.

Known race: two `page-seen` messages handled at the same time can both read the same count, and one increment is lost. This is acceptable for a demo counter (see Risk).

### `background.ts`

Wiring only, about 10 lines:

```ts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg, chrome.storage.session).then(sendResponse);
  return true;
});
```

`return true` tells Chrome that `sendResponse` will be called later. Every Chromium version supports this form.

### `lib/settings.ts`

```ts
export interface Settings { greeting: string }
export const DEFAULT_SETTINGS: Settings = { greeting: "Hello" };
export const MAX_GREETING_LENGTH = 100;

export async function loadSettings(area: Store): Promise<Settings>;
export function validateGreeting(text: string): string | null; // error text, or null if valid
export async function saveSettings(area: Store, settings: Settings): Promise<void>;
```

- Settings live in `chrome.storage.sync` under the key `"settings"`.
- `loadSettings` returns `DEFAULT_SETTINGS` when nothing is saved or the saved value is not a valid `Settings`.
- `validateGreeting` trims the text. It returns `"Greeting cannot be empty"` for empty text and `"Greeting must be at most 100 characters"` for longer text.
- `saveSettings` throws if `validateGreeting` returns an error. So invalid data never reaches storage, even if a caller skips the check.

The 100-character limit keeps the value far below the `storage.sync` limit of 8 KB per item.

### `content.ts`

On load, it sends `{ type: "page-seen" }` with `chrome.runtime.sendMessage`. It ignores the reply.

If the extension was reloaded while the tab stayed open, the old content script loses its connection. The call then throws or rejects with "Extension context invalidated". The script catches both and does nothing.

### Popup (`popup/`)

On open, it loads the settings and sends `get-stats`. It shows:

- the greeting as a heading;
- "Pages seen this session: N";
- a "Reset" button that sends `reset-stats` and shows the new count.

If `sendMessage` rejects, the count line shows "Background not reachable". If the reply has `ok: false`, the count line shows "Error: " followed by the reply's `error` text.

### Options page (`options/`)

One text field for the greeting, a "Save" button and a status line.

- On open, it fills the field from `loadSettings`.
- On Save, it calls `validateGreeting`. If there is an error, the status line shows the error and nothing is saved. If not, it calls `saveSettings` and shows "Saved". If `saveSettings` rejects, for example because `storage.sync` hit its write-rate limit, the status line shows "Could not save: " followed by the error's message.

## Demo flow

1. Open the options page. Change the greeting to "Hi there". Click Save.
2. Open two `https://` pages. Each load sends `page-seen`.
3. Click the toolbar icon. The popup shows "Hi there" and "Pages seen this session: 2".
4. In `chrome://extensions`, stop the service worker. Close any DevTools window open on it first, and then wait about 30 seconds until the entry shows "service worker (inactive)". Open the popup again. The count is still 2, which proves the counter does not live in memory.
5. Click Reset. The count shows 0.

Reloading the extension in `chrome://extensions` also resets the count to 0. That is expected: Chrome clears `storage.session` on reload.

## Error handling

| Case | Behaviour |
|---|---|
| Unknown or malformed message | Handler replies `{ ok: false, error: "unknown message" }`. |
| Popup cannot reach the service worker | Count line shows "Background not reachable". |
| Storage call fails in the service worker | `handleMessage` replies `{ ok: false, error }`; the popup shows "Error: " and the text. |
| Saving settings fails | Options status line shows "Could not save: " and the error text. |
| Extension reloaded while a tab is open | Content script catches "Extension context invalidated" and stays silent. |
| Greeting empty or over 100 characters | Options page shows the error and does not save. `saveSettings` also throws. |
| Saved settings are corrupt | `loadSettings` returns the defaults. |

## Visual Language

There is no design system in this project. The two pages use plain HTML controls and share one stylesheet, `popup/popup.css`. The options page links it with `../popup/popup.css`.

| Element | Primitive | Styling |
|---|---|---|
| Greeting | `<h1>` | system font stack, 1.25rem |
| Count line | `<p id="count">` | default text colour |
| Reset / Save | `<button>` | native button |
| Greeting field | `<label>` + `<input type="text" maxlength="100">` | native input |
| Status line | `<p id="status" role="status">` | announced to screen readers |

`popup.css` sets `color-scheme: light dark`, so native controls follow the browser theme. The popup's `<body>` has `class="popup"`, and only the `.popup` rule sets the 260px width. The options page has no width rule, so it fills the tab. No motion.

This UI was not drawn on a design canvas. The user decided on 2026-10-02 that, for this playground, two forms of native controls do not need one.

## Testing

`npm test` runs: `npm run build`, then `tsc -p tsconfig.test.json`, then `node --test ".test-build/test/**/*.test.js"`. The glob is quoted so Node expands it, not the shell. A bare directory path fails on Node 22 with `MODULE_NOT_FOUND`. The `*.test.js` pattern also keeps `fakes.js` from running as a test file.

1. **`handler.test.ts`** (with the fake store from `fakes.ts`):
   - an empty store gives `{ ok: true, count: 0 }` for `get-stats`;
   - two `page-seen` messages give counts 1 and then 2;
   - `reset-stats` after two `page-seen` gives 0, and `get-stats` then gives 0;
   - an unknown `type`, `null` and a string each give the error reply;
   - a non-number stored value is treated as 0;
   - a store whose `get` rejects gives `{ ok: false, error: <that message> }`, and `handleMessage` itself resolves.
2. **`settings.test.ts`** (with the fake area):
   - nothing saved gives `DEFAULT_SETTINGS`;
   - a saved value of the wrong shape gives `DEFAULT_SETTINGS`;
   - save then load returns the trimmed greeting;
   - `validateGreeting` rejects empty, whitespace-only and 101-character text, and accepts 100 characters;
   - `saveSettings` throws on an invalid greeting and leaves storage unchanged.
3. **`build.test.ts`** (reads the real `dist/`):
   - every file named in `dist/manifest.json` (`background.service_worker`, `action.default_popup`, `options_page`, each `content_scripts[].js`) exists in `dist/`;
   - every `<script src>` and `<link href>` in `dist/**/*.html` points to an existing file;
   - every `<script>` in `dist/**/*.html` has `type="module"`;
   - `dist/content.js` contains no line that starts with `import` or `export`.

The manifest is the extension's public surface, and `build.test.ts` exercises it against real build output.

**Not unit-tested:** the DOM code in `popup.ts` and `options.ts`, and the 10 lines of `background.ts`. Testing them needs a fake DOM library such as `jsdom`, or browser automation. Both add dependencies. These files stay thin, and the demo flow above is the manual check.

## Trade-offs

- **`tsc` only vs a bundler (Vite, esbuild) or a framework (WXT).**
  - `tsc` only. Pros: two-package toolchain; the output is readable and matches the source line for line. Cons: imports need `.js` endings; the content script cannot share runtime code; static files need a copy script; no hot reload.
  - Bundler or framework. Pros: shared code in content scripts, hot reload, multi-browser builds. Cons: many dependencies, and the build hides how MV3 really loads files.
  - **Chosen:** `tsc` only, because the goal is learning how MV3 works.
- **Chromium only vs also Firefox.** Firefox needs `background.scripts` instead of a service worker, and some APIs differ. Chosen: Chromium only. Adding Firefox later means adding `background.scripts` to the manifest and testing in Firefox.
- **`storage.session` vs `storage.local` for the counter.** `session` resets when the browser closes or the extension reloads, which fits "pages seen this session". `local` would keep it forever. Chosen: `session`.
- **`sendResponse` + `return true` vs returning a Promise from the listener.** Newer Chrome versions may accept a returned Promise, but support is not certain across Chromium versions. Chosen: the callback form, which all versions support.

## Dependencies

All dev dependencies; there are no runtime dependencies.

| Package | Version | Why |
|---|---|---|
| `typescript` | `^7.0.2` | the `tsc` compiler (TypeScript 7 is the native compiler; the `tsc` command is unchanged) |
| `@types/chrome` | `^0.3.4` | types for `chrome.*` APIs |
| `@types/node` | `^22.20.5` | types for `node:test`, `node:assert`, `node:fs`; major version 22 to match Node 22 |

Runtime needed on the developer machine: Node 22 (22.17.0 is installed) and a Chromium browser.

## Risk

- **TypeScript 7 is new.** It is a rewrite of the compiler. If a setting in this spec behaves differently in 7.x, the plan's first build step will show it. Fallback: pin `typescript@^5`, which is the same command.
- **`tsc` may emit `export {};` into `content.js`.** That breaks the content script with a syntax error. A check on 2026-10-02 showed this happens with any setting except `"moduleDetection": "legacy"` plus inline type imports. Detection: `build.test.ts`. A future TypeScript version could change or remove `legacy`; the test would then fail on the next build.
- **Lost increments.** Two `page-seen` messages handled at once can lose one increment (read-modify-write race). Known limit, accepted for a demo counter. Not a finding.
- **Forgetting to rebuild static files.** `npm run watch` does not copy HTML, CSS or the manifest. Detection: the page looks stale in Chrome. Mitigation: documented in this spec under "Build".
- **Nothing is hard to reverse.** There is no published extension, no stored user data that matters, and no public API.

## Open questions

None. The project's Git workflow (scopes, test command, no plans index, no remote) is in `CLAUDE.md`.
