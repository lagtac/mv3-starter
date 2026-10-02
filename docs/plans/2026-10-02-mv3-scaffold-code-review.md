# MV3 scaffold: bug review of the branch

**Status:** review of main..feat/mv3-scaffold, 2026-10-02. `/code-review high` against the plan `docs/plans/2026-10-02-mv3-scaffold.md` and its spec; the skill returned findings inline only, so this file records them, the fix round and the final re-review.

**Scope:** `main..feat/mv3-scaffold`, the four task commits, 21 files, without the lockfile. Known limits in the plan's **Risk** section were not reported.

## Findings

| # | Where | Finding | Severity | Outcome |
|---|---|---|---|---|
| 1 | `src/options/options.ts` | A failed settings load fills the field with "Hello", so the next Save overwrites the stored greeting. The soundness review found the same. | Medium | Fixed in the fix round. The user chose this, because it changes a reading the plan had recorded. The status line shows "Could not load: " and the field stays empty. |
| 2 | `src/options/options.ts` | A slow load replaces text typed before it finishes. | Low | Added to **Risk**. The load takes milliseconds. |
| 3 | `src/popup/popup.ts` | `reply.ok` throws if `sendMessage` resolves `undefined`. | Medium | Added to **Risk**. Today's code never produces an empty reply. |
| 4 | `package.json` | `npm test` never clears `.test-build/`, so a renamed test still runs. | Low | Added to **Risk**. A fix would change the `npm test` command the spec sets. |
| 5 | `src/options/options.html` | `maxlength="100"` counts spaces; `validateGreeting` counts trimmed text. | Low | Added to **Risk**. The user kept the spec's `maxlength`. |
| 6 | `src/background.ts` | The listener does not check `sender`. | Low | Added to **Risk**. Web pages cannot message the extension. |
| 7 | `src/lib/handler.ts` | `isMessage` repeats the `Message` type strings. | Low | Rejected. A cleanup of the plan's chosen code; nothing fails today. |
| 8 | `src/popup/popup.ts` | The load fallback is copied in two pages. | Low | Rejected. After finding 1, the two pages handle a failed load differently on purpose. |
| 9 | `src/options/options.ts` | Validation runs in the submit handler and in `saveSettings`. | Low | Rejected. The spec asks for both: the page shows the error, and `saveSettings` also throws. |
| 10 | `package.json` | No `engines` field, so Node 20 fails without naming the cause. | Low | Fixed in the fix round: `"engines": { "node": ">=22" }`. |

## Final re-review

`/code-review high` ran once more on the same range after the fix round. It found the fix round correct and raised no Critical finding. Under the one-fix-round rule, its findings were not fixed:

| # | Where | Finding | Outcome |
|---|---|---|---|
| R1 | `src/lib/handler.ts` | A `page-seen` that reads the count before a Reset and writes after it undoes the Reset. | **Risk**: widened "Lost increments". |
| R2 | the plan, Task 4, Step 8 | The code block still shows the old `options.ts`. The soundness re-review found the same, and also the `package.json` block without `engines`. | Plan notes added under Task 4, Step 8 and in **Dependencies**. |
| R3 | the first soundness review | Its verdict predates the fix round. | Kept as written: it records the branch before the fix round. The second soundness review records the result. |
| R4 to R7 | `content.ts`, `build.test.ts`, `tsconfig.json`, `settings.ts` | Second injection of the content script, the module-syntax check, `DOM` types in the service worker, unfrozen `DEFAULT_SETTINGS`. | **Risk**: four new entries. |
| R8 to R10 | `options.ts`, `options.html`, `package.json` | The error-text expression repeats three times; both pages share one stylesheet; `npm test` compiles `src/` twice. | Not acted on. Cleanups; the shared stylesheet is a spec decision. |

## Checks

- `npm test`: 19 pass, 0 fail, before and after the fix round.
- Manual demo flow in Chrome (spec, "Demo flow", steps 1 to 5): passed, as reported by the user before the reviews.
