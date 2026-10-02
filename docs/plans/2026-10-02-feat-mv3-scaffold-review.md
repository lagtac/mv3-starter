# Review: main..feat/mv3-scaffold

**Status:** review of main..feat/mv3-scaffold, 2026-10-02. Sound: the branch carries out the plan exactly, and the one surfaced finding is a Suggestion: the options page hides a failed settings load behind the default greeting.

## Change Summary

The branch adds a Chromium Manifest V3 extension built by `tsc` alone. It has a service worker, a content script, a popup and an options page. Two pure modules, `src/lib/handler.ts` (the page counter in `chrome.storage.session`) and `src/lib/settings.ts` (the greeting in `chrome.storage.sync`), hold all the logic. The four extension parts only connect those modules to Chrome. Tests use `node:test`: 8 handler tests, 5 settings tests, and 6 tests that check the real `dist/` output.

## Plan Alignment

The implementation matches `docs/plans/2026-10-02-mv3-scaffold.md` exactly. I checked this mechanically. All 18 source, config and test files whose full text the plan gives are identical to its code blocks. `test/build.test.ts` matches the Task 3 block plus the Task 4 import change and appended tests. `package.json` matches Task 1 Step 1 plus the installed `devDependencies` and the Task 3 `build` script.

The intermediate states also match the plan:

- In the first commit (Task 1), the `build` script has no copy step.
- The Task 3 commit's `manifest.json` has no `action` and no `options_page`.
- The Task 3 commit's `build` script gains `node scripts/copy-static.mjs`.

The four commits match the four tasks, with the plan's commit messages and file lists. No commit removed or weakened a test assertion. The only removed test lines are the two import lines in `test/build.test.ts:3-4`, which Task 4 Step 1 tells the executor to change.

Deviations from the plan: none.

Deviations from the spec are the two that the plan records and justifies in its Context section:

- `"include"` in both tsconfig files (`tsconfig.json:14`, `tsconfig.test.json:8`).
- `.claude/worktrees/` in `.gitignore:4`.

The test count goes beyond the spec's list (Review Focus 1 to 5). Both are justified.

## Issues Surfaced

| Severity / Confidence | Issue | Evidence | Fix |
|---|---|---|---|
| Suggestion / High | The options page hides a failed settings load. If `storage.sync.get` rejects, the field shows the default "Hello" as if it were the saved greeting, and the status line says nothing. A Save from that state then replaces the stored greeting, and the user never learned the load failed. The popup has the same fallback (`src/popup/popup.ts:23-24`), but there it only affects display. | `src/options/options.ts:7-11`, `src/options/options.ts:20` | In `options.ts`, on a load rejection, write a line such as "Could not load: " plus the error text to `statusLine`, and leave the field empty. Or keep the behaviour and record it in the plan's **Risk** section as a known limit. The plan's Open Questions already note "a rejected settings load shows the defaults" as a reading of the spec. |

## Dual-Perspective Analysis

**Arguments this is sound:**

| Aspect | Evidence | Strength |
|---|---|---|
| The logic is separate from the Chrome wiring, so it can be tested with in-memory fakes | `src/lib/handler.ts:17`, `src/lib/settings.ts:21`, `src/background.ts:4-7`, `test/fakes.ts:8` | Strong |
| The counter survives a service worker restart, because it lives in `storage.session`, not in a variable (the root cause the spec names) | `src/background.ts:5`, `src/lib/handler.ts:11-15` | Strong |
| `handleMessage` never rejects, so `sendResponse` is always called and `return true` never leaves a message channel hanging | `src/lib/handler.ts:18-31`, `test/handler.test.ts:43-56` | Strong |
| The rule that `content.js` is a classic script is enforced by a test on the real output, and the built file has no `import` or `export` line | `src/content.ts:1-3`, `test/build.test.ts:39-43`, `dist/content.js:1` | Strong |
| Invalid greetings cannot reach storage, even when a caller skips the check | `src/lib/settings.ts:30-33`, `test/settings.test.ts:41-46` | Strong |
| The public surface (the manifest and the page references) is checked against the real build output, and the "exactly two pages" test stops the page checks from passing on an empty `dist/` | `test/build.test.ts:27-37`, `test/build.test.ts:57-59` | Moderate |
| Only the three approved dev dependencies; the other lockfile entries are their own dependencies or TypeScript's optional platform binaries | `package.json:12-16`, `package-lock.json` | Strong |

**Arguments this has problems:**

| Aspect | Evidence | Severity |
|---|---|---|
| A rejected settings load is replaced by the defaults with no message on the options page | `src/options/options.ts:7-11` | Low |

## Not Applicable

None.

## Reasoning

All five dimensions applied. The change solves the stated problem: it carries out the spec's design, the tests pass, and the user ran the manual demo flow. It fits a new project's own conventions: logic in `lib/`, thin entry points, and shared types in one module. The approach treats the root causes: storage instead of in-memory state, and a test on the build output for the classic-script rule.

Risk is low. Every file is new and nothing was removed or renamed. A text search (`grep -rn`; I had no symbol-reference tool) for `handleMessage`, `loadSettings`, `saveSettings`, `validateGreeting` and `DEFAULT_SETTINGS` found only the callers listed in the review map.

The one surfaced finding is a fallback that hides a failure, which is dimension 3's concern. I rated it a Suggestion, not a Warning, for three reasons:

- It needs a rare `storage.sync.get` rejection.
- The resulting write only happens when the user clicks Save, and Save writes the visible field.
- The plan records "a rejected settings load shows the defaults" as a deliberate reading of the spec.

Everything else I checked is either listed in the plan's **Risk** section or is a decision the spec settled.

## Verdict

**Assessment:** Sound
**Confidence:** High — every file and intermediate state was checked mechanically against the plan, and the only gap found is a narrow, documented fallback.
**Recommendation:** Merge as planned. Before the merge, either add a status-line message for a failed load in `src/options/options.ts:7-11`, or add a "masked settings load on the options page" known limit to the plan's **Risk** section.
