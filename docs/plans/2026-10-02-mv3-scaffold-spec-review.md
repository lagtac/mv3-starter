# Review: docs/plans/2026-10-02-mv3-scaffold-spec.md

**Status:** review of docs/plans/2026-10-02-mv3-scaffold-spec.md, 2026-10-02. Mixed: the design is sound and its riskiest claim (the content-script compile table) holds against `tsc` 7.0.2. But the `npm test` command as written fails on Node 22.17, so success criterion 4 cannot pass. The demo's persistence step also cannot prove what it says it proves.

## Spec Summary

The spec sets up a Chromium-only Manifest V3 extension as a learning playground. It is built with `tsc` alone plus a small copy script, so there is no bundler. It has four parts: a service worker, a popup, a content script and an options page. A page counter lives in `chrome.storage.session`, and a greeting setting lives in `chrome.storage.sync`. All counter logic sits in a pure `handleMessage(msg, store)`, and all settings logic sits in `lib/settings.ts`. Tests use `node:test` on those modules and on the real `dist/` output.

## System Model

The repo holds only the spec and an empty git repository, on branch `main` with no commits. Every component is new. Chrome APIs are external.

| Component | Owns | Depends on | New / existing (verified at) |
|---|---|---|---|
| `manifest.json` | Extension entry points, permission `storage`, content-script match `https://*/*` | `background.js`, `popup/popup.html`, `options/options.html`, `content.js` in `dist/` | New (not found; repo is empty) |
| Build: `tsconfig.json` + `scripts/copy-static.mjs` | `dist/` layout; module-detection rule; static-file copy | `typescript`, `@types/chrome`, Node `fs` | New |
| `lib/messages.ts` | `Message` and `Reply` types (the message contract) | none | New |
| `lib/handler.ts` | Counter logic; key `"pageCount"`; the `Store` interface | `messages.ts`, a `Store` | New |
| `lib/settings.ts` | `Settings` shape, defaults, 100-character limit, validation; key `"settings"` | `Store` (taken from `handler.ts`), `chrome.storage.sync` via the caller | New |
| `background.ts` | Wiring `runtime.onMessage` to `handleMessage` | `handler.ts`, `chrome.storage.session` | New |
| `content.ts` | Sending `page-seen` on page load; swallowing "context invalidated" errors | `chrome.runtime`; types only from `messages.ts` | New |
| Popup (`popup.html/css/ts`) | Greeting and count display; Reset; "Background not reachable" state; the only stylesheet | `settings.ts`, `chrome.runtime`, `chrome.storage.sync` | New |
| Options page (`options.html/ts`) | Greeting form, Save, status line | `settings.ts`, `../popup/popup.css`, `chrome.storage.sync` | New |
| `chrome.storage.session` | Counter value at runtime | Chrome | External |
| `chrome.storage.sync` | Settings value at runtime | Chrome | External |
| Tests (`test/*.ts`, `tsconfig.test.json`) | `.test-build/`; fakes | `@types/node`, `node:test`, `src/`, `dist/` | New |

| From → To | What passes | Owner of what passes |
|---|---|---|
| content → background | `runtime.sendMessage({type:"page-seen"})` event; the reply is ignored | `messages.ts` (contract) |
| popup → background | `get-stats` and `reset-stats` messages; `Reply` back | `messages.ts` |
| background → handler | call `handleMessage(msg, chrome.storage.session)` → `Promise<Reply>` | `handler.ts` |
| handler → storage.session | `get("pageCount")` / `set({pageCount})`, which is shared state | `handler.ts` owns the key; Chrome owns the store |
| popup, options → settings | calls `loadSettings` / `validateGreeting` / `saveSettings` | `settings.ts` |
| settings → storage.sync | `get("settings")` / `set({settings})` | `settings.ts` owns the key |
| options.html → popup.css | relative `<link href>` | Popup owns the file |
| build → `dist/` | compiled `.js` files plus copied manifest, HTML and CSS | Build |
| `build.test.ts` → `dist/` | reads the files back | Build owns `dist/`; the test only reads |

## Grounding

The repo is empty, so grounding covers external tools and Chrome behaviour. Nothing is removed or renamed, so no caller sweep was needed. All repo searches were text-only (`find`/`grep`); there is no symbol tool.

- `spec §Testing` (`node --test .test-build/test/`) ↔ Node 22.17.0, run in a scratch directory. A directory argument is loaded as a module and fails with `Cannot find module '.../.test-build/test'` (`not ok 1`). Bare `node --test` skips dot-directories and runs 0 tests. `node --test '.test-build/test/**/*.test.js'` passes.
- `spec §lib/handler.ts` ("`storage.session` keeps the value until the browser closes") ↔ Chrome storage reference (<https://developer.chrome.com/docs/extensions/reference/api/storage>): "The storage is cleared if the extension is disabled, reloaded, updated, and when the browser restarts."
- Claims that were checked and hold:
  - The four-row `moduleDetection` table in `spec §The content script rule` was reproduced with `tsc` 7.0.2. With `legacy` plus an inline `import()` type, the output starts with `"use strict";` and has no `export {};`. Every other combination gives `export {};`.
  - `chrome.storage.session` and `chrome.storage.sync` both type-check as `Store` with `@types/chrome` 0.3.4. So does the `background.ts` listener.
  - `tsconfig.test.json` as described compiles `src` and `test` with `@types/node` 22.20.5, and keeps `content.js` a script.
  - `@types/node@22.20.5` and `@types/chrome@0.3.4` exist on npm.
  - The idle stop after 30 seconds and the promise-returning `onMessage` matches the Chrome docs. The messaging page says "From Chrome 148 … rolling out gradually", so the Trade-offs reasoning holds.

## Issues Surfaced

| Severity / Confidence | Class | Issue | Evidence | Fix |
|---|---|---|---|---|
| Warning / High | editorial | `npm test` fails as written. `node --test .test-build/test/` treats the directory as a module, so success criterion 4 can never pass. | `spec §Testing`; reproduced on Node 22.17.0 (scratch run: `MODULE_NOT_FOUND`, `not ok 1`) | Use `node --test ".test-build/test/**/*.test.js"`, quoted so Node expands the glob. This also keeps `fakes.js` from running as a test. |
| Warning / High | editorial | Demo step 5 cannot prove persistence. Step 4 resets the count to 0, so "still the same value" is 0, which an in-memory variable would also show after a restart. | `spec §Demo flow` ↔ `§lib/handler.ts` ("Showing this is one of the purposes of the demo") | Stop the worker before step 4, or open one more page after Reset, so the value checked after the restart is not 0. |
| Warning / High | editorial | Storage lifetime is stated wrongly. `storage.session` is also cleared when the extension is reloaded, updated or disabled, not only when the browser closes. In this project's loop (D1: "quick to reload"), every rebuild and reload resets the counter, and a learner will see that. | `spec §lib/handler.ts`, `§Trade-offs` ↔ Chrome storage reference, "cleared if the extension is disabled, reloaded, updated" | Correct the sentence. Add a note to the demo flow that reloading the extension resets the count. |
| Warning / High | editorial | Nothing says the popup and options HTML must load their scripts with `<script type="module">`. `popup.ts` and `options.ts` import lib files, so their output is ES modules, and a plain `<script src>` fails with a syntax error. `build.test.ts` checks only that the `src` file exists, so this would surface only in the manual demo. | `spec §Compiler settings`, `§Popup`, `§Options page`, `§Testing` item 3 | State the module script tag in the Architecture section. Optionally extend `build.test.ts` to assert `type="module"` on every `<script>` in `dist/**/*.html`. |
| Warning / Medium | design | Storage failures have no stated outcome. If `store.get`/`set` rejects in `handleMessage`, `sendResponse` is never called: the popup shows "Background not reachable" and the worker gets an unhandled rejection. If `chrome.storage.sync.set` rejects in `saveSettings` (for example, a write-rate quota), the options page result is not specified. The `Reply` type's `ok: false` branch could carry this, but the spec limits it to "unknown message". | `spec §lib/handler.ts`, `§background.ts`, `§Options page`, `§Error handling` | Decision for the author: either `handleMessage` never rejects (it catches and returns `{ok:false, error}`), or the rejection is accepted and documented. Also state what the options page shows when save fails. |
| Suggestion / High | design | `settings.ts` takes its `Store` interface from `handler.ts`, so the settings module depends on the counter module for a type both of them share. Separately, the options page links `popup/popup.css`, which sets a 260px body width, onto a full-tab page. The text also says both "one small stylesheet each" and "one stylesheet in total". | `spec §lib/settings.ts` (`area: Store`), `§Visual Language` | Move `Store` to its own file (for example `lib/store.ts`) or into `messages.ts`. Scope the 260px width to the popup only, and make the stylesheet sentence say one thing. |

## Dual-Perspective Analysis

**Arguments this is sound:**

| Aspect | Evidence | Strength |
|---|---|---|
| Grounding of the hardest risk | The four-row `moduleDetection` table reproduces exactly with `tsc` 7.0.2, and `build.test.ts` guards it | Strong |
| Boundaries | All counter logic is in `handleMessage(msg, store)`; `background.ts` is wiring only; settings logic is in one module that both pages use | Strong |
| Contracts | One `Message`/`Reply` union. `msg: unknown` with an explicit error reply for bad input. The `Store` interface matches both Chrome areas (type-checked) | Strong |
| State ownership | Counter in `storage.session` under one key; settings in `storage.sync` under one key; each has one writer module | Strong |
| Trade-offs | The four choices are real, with reasons. The `return true` choice matches the Chrome docs: Promise return is "Chrome 148, rolling out gradually" | Moderate |
| Spec rules | "How to read this spec" comes first. Risk, Dependencies and Trade-offs are present. Visual Language is present for the new UI | Strong |

**Arguments this has problems:**

| Aspect | Evidence | Severity |
|---|---|---|
| Grounding | `npm test` command fails on Node 22.17; `storage.session` lifetime is misstated | Medium |
| Failures | Storage rejections are unhandled in the handler path and unspecified on the options page | Medium |
| Contracts | The HTML-to-module script loading contract is unstated and untested | Medium |
| Demo as manual check | Step 5 checks the value 0, so it cannot tell persisted state from a reset | Medium |
| Boundaries | `Store` is owned by `handler.ts` but shared with `settings.ts`; the options page depends on popup CSS | Low |

## Not Applicable

- Fit with what exists, "the repo already solves it" and "follows existing patterns" parts: the repo is empty, with only the spec and a `.git` directory with no commits. The rejected-options part was judged above under Trade-offs.

## Needs Investigation

- **Does opening the service worker's DevTools keep it alive?** Demo step 5 says the "service worker" link opens DevTools, "or wait 30 seconds". If an open DevTools window prevents the idle stop, a learner who opens it and then waits will never see the worker stop. The lifecycle page (<https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle>) does not mention DevTools. To resolve: check in Chrome, or name an explicit stop control, such as the Stop button in `chrome://serviceworker-internals`.
- **The UI is not drawn.** The author's global rule requires a design canvas. The spec already raises this as Open question 1, so it is left to the user and is not a finding here.

## Reasoning

The System Model is clean: each component has one job, each key has one owner, and the message contract is a single typed union. The spec's unusual compiler claim was reproduced exactly. The surfaced problems are a broken test command, a demo step that checks the wrong value, a misstated storage lifetime, an unstated module script tag, and unspecified storage-failure paths. None of them challenges the chosen architecture. Four are text fixes, and one (storage failures) is a small contract decision for the author.

## Verdict

**Assessment:** Mixed
**Confidence:** High. The key compiler, type and Node claims were run in scratch directories, and the Chrome claims were checked against the current docs.
**Recommendation:** Fix the four editorial rows: the test glob, the demo order, the storage lifetime and the module script tag. Then ask the author whether `handleMessage` and `saveSettings` should turn storage rejections into `{ok:false}` replies or status messages, before writing the plan.
