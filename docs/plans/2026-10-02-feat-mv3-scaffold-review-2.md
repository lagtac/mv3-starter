# Review: main..feat/mv3-scaffold

**Status:** review of main..feat/mv3-scaffold, 2026-10-02. Sound: the fix round fixes the earlier finding the way the updated spec says, and the one surfaced finding is a Suggestion: the plan's code blocks for `options.ts` and `package.json` still show the state before the fix round.

## Change Summary

The branch adds a Chromium Manifest V3 extension built by `tsc` alone: a service worker, a content script, a popup and an options page, with all logic in `src/lib/handler.ts` and `src/lib/settings.ts`. This re-review covers the fix round on top of the earlier review. In the fix round, `src/options/options.ts` shows "Could not load: " and leaves the field empty when the settings load fails, `package.json` gains `"engines": { "node": ">=22" }`, and the spec's error table, the plan's **Risk** section and Open Questions record the changes. The branch also adds the earlier soundness review and a record of the `/code-review` findings.

## Plan Alignment

The code matches the updated spec. The plan matches it in its **Risk** section and Open Questions, but two of its code blocks were not updated.

- `src/options/options.ts:7-15` matches the spec's new error-table row (`docs/plans/2026-10-02-mv3-scaffold-spec.md:274`): the status line shows "Could not load: " plus the error text, and the field stays empty. `src/popup/popup.ts:23-27` keeps the default greeting, as the same row says.
- The plan's Open Questions (`docs/plans/2026-10-02-mv3-scaffold.md:989`) record the options-page change and the user's choice. The Task 4, Step 8 code block (`docs/plans/2026-10-02-mv3-scaffold.md:875-904`) still shows the old `.catch(() => DEFAULT_SETTINGS)` version, and nothing near Step 8 points to the change. This is a recorded deviation, but a reader of Step 8 sees code the branch does not have.
- `package.json:6-8` adds `engines`. The plan's Task 1, Step 1 block (`docs/plans/2026-10-02-mv3-scaffold.md:104-116`) has no `engines` field, and neither the plan's nor the spec's **Dependencies** section names it. Only `docs/plans/2026-10-02-mv3-scaffold-code-review.md:20` records it.
- The five new **Risk** entries (`docs/plans/2026-10-02-mv3-scaffold.md:971-975`) match the `/code-review` record's "Added to **Risk**" rows 2 to 6. They are known limits, so they are not findings here.
- No orphaned callers. The fix round removed the `DEFAULT_SETTINGS` import from `options.ts`. A text search (`grep -rn DEFAULT_SETTINGS src test`; I had no symbol-reference tool) finds it still used only in `src/popup/popup.ts:2,24`, `src/lib/settings.ts` and the settings tests. The plan's Task 4 "Consumes" list still holds, because the popup uses it.

## Issues Surfaced

| Severity / Confidence | Issue | Evidence | Fix |
|---|---|---|---|
| Suggestion / High | The plan's code blocks do not show the fix round. Task 4, Step 8 still gives the old `options.ts` that falls back to the defaults, and Task 1, Step 1 gives a `package.json` without `engines`. The `engines` field is named in neither the plan nor the spec. A cold reader who rebuilds from the plan, or checks the branch against it, finds two mismatches with no pointer to their reason. | `docs/plans/2026-10-02-mv3-scaffold.md:878-889` (Task 4, Step 8) vs `src/options/options.ts:1-15`; plan Task 1 Step 1 (`docs/plans/2026-10-02-mv3-scaffold.md:104-116`) vs `package.json:6-8` | Add one line under Task 4, Step 8: "Changed at the end-of-branch review: see Open Questions." Add `engines` to the plan's **Dependencies** line on Node 22. Leaving the code block as a history record is fine once the pointer exists. |

## Dual-Perspective Analysis

**Arguments this is sound:**

| Aspect | Evidence | Strength |
|---|---|---|
| The fix treats the root cause the earlier review named: on a failed load, the field no longer holds a value Save could write over the stored greeting. An empty field fails `validateGreeting`, so a Save from that state writes nothing. | `src/options/options.ts:8-15`, `src/options/options.ts:19-22`, `src/lib/settings.ts:13-14` | Strong |
| The failure is now shown, not masked: the status line names it, using the same error-text form as the existing "Could not save: " branch | `src/options/options.ts:13`, `src/options/options.ts:29` | Strong |
| The two pages differ on purpose, and the spec says so: the popup only displays the greeting, so the default there cannot cause a write | `src/popup/popup.ts:23-27`, `docs/plans/2026-10-02-mv3-scaffold-spec.md:274` | Strong |
| `.then(onFulfilled, onRejected)` changes only the rejection path; the success path still sets the field exactly as before | `src/options/options.ts:8-11` | Moderate |
| The design decision went to the user, not into a silent change, and the plan and spec record it with the date | `docs/plans/2026-10-02-mv3-scaffold.md:989`, `docs/plans/2026-10-02-mv3-scaffold-spec.md:274` | Strong |
| `engines: >=22` matches the Node features the build and tests rely on (`readdirSync` recursive, `Dirent.parentPath`, the `node --test` glob) and the Node 22 the plan names. npm treats `engines` as advisory, so it only warns at install time | `package.json:6-8`, `scripts/copy-static.mjs:18-20`, `package.json:13` | Moderate |
| `npm test` passes after the fix round: I ran it, 19 pass, 0 fail | `package.json:13` | Strong |

**Arguments this has problems:**

| Aspect | Evidence | Severity |
|---|---|---|
| The plan's code blocks for `options.ts` and `package.json` no longer match the branch, and `engines` is recorded only in the bug-review record | `docs/plans/2026-10-02-mv3-scaffold.md:878-889`, `docs/plans/2026-10-02-mv3-scaffold.md:104-116`, `docs/plans/2026-10-02-mv3-scaffold-code-review.md:20` | Low |

## Not Applicable

None.

## Reasoning

All five dimensions applied. The fix round solves the earlier finding at its cause: the options page no longer puts a value in the field that it did not load, and it reports the failure instead of hiding it. That is the behaviour the user chose and the spec now states. The change stays in the page's wiring, matches the existing "Could not save: " branch, and removes no symbol that another file uses. The new **Risk** entries are known limits, so they are not findings. The only gap is in the plan document: its code blocks still show the state before the fix round. That costs a cold reader some confusion and does not affect the code, so it is a Suggestion. The options-page wiring has no unit tests (a known limit in **Risk**), and the manual demo flow ran before the fix round. The change touches only the rejection path, which the demo flow does not exercise, so that does not lower the verdict.

## Verdict

**Assessment:** Sound
**Confidence:** High — I read every changed file in full, checked the fix against the spec's error table and the plan, swept for the removed import, and ran `npm test`.
**Recommendation:** Merge. Before or with the merge, add a pointer under the plan's Task 4, Step 8 to the Open Questions note, and name the `engines` field in the plan's **Dependencies**. Both are `docs:` edits.
