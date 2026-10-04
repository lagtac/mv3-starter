# Review: main..feat/template-gaps

**Status:** review of main..feat/template-gaps, 2026-10-04. Sound: the fix round resolved or moved to **Risk** every finding from the first review; the only remaining finding is a Suggestion that the plan's text no longer describes the fix round's main-module check and test count.

## Change Summary

The branch makes `scripts/copy-static.mjs` export `copyStatic()` and `STATIC_FILE`, writes the `package.json` version into `dist/manifest.json`, copies `.png` files, and adds `scripts/watch.mjs` (`tsc --watch` plus re-copying static files) and `scripts/package.mjs` (zips `dist/` with the system `zip`). It adds four placeholder icons, narrows the content script to `https://example.com/*`, and adds eight tests to `test/build.test.ts`. The fix round made the copy step's main-module check symlink-safe, shared the static-file regex, started the watchers before `tsc` with error handlers that stop it, and added the first review report plus five known limits to the plan's **Risk**.

## Plan Alignment

The implementation matches the plan task for task (Tasks 1 to 5: script lines, exact messages, match pattern, icon keys, zip path, 100 ms debounce, exit-code rules). `pnpm test` passes at the branch head: 27 tests, 0 skipped. Deviations:

- `scripts/copy-static.mjs:48`: the main-module check uses `realpathSync(process.argv[1])`; the plan's Task 1, Step 4 still says `pathToFileURL(process.argv[1])`. The change is justified (a symlinked path ran nothing before) and pinned by a new test, but the plan text was not updated. Surfaced below as a Suggestion.
- `test/build.test.ts:112-129`: an eighth new test ("the copy step runs when started through a symlinked path"). The plan's Testing Strategy still says "7 new ones". Same Suggestion.
- `scripts/copy-static.mjs:25`, `scripts/watch.mjs:7,38`: `STATIC_FILE` is exported and shared. The plan's Task 5 only said "ends in `.html`, `.css` or `.png`"; sharing the regex follows the plan's Architecture ("the one owner"). Not a finding.
- `scripts/watch.mjs:34-44,62-69`: watchers start before `spawn("tsc")` and each has an `error` handler that kills `tsc`. The plan did not specify order or watcher errors; this adds behaviour without changing the plan's contract (exit 0 on a signal stop, otherwise the child's code or 1). Not a finding.

No plan item is missing from the diff.

## Issues Surfaced

| Severity / Confidence | Issue | Evidence | Fix |
|---|---|---|---|
| Suggestion / High | **New.** The plan's text no longer matches the code after the fix round: Task 1, Step 4 prescribes the plain `pathToFileURL(process.argv[1])` check, and Testing Strategy counts 7 new tests where the branch has 8. A cold reader comparing the plan with the code (or reusing the plan as a template) would reintroduce the symlink bug. The plan's **Risk** was updated in the fix round; the task text was not. | `scripts/copy-static.mjs:48`; `test/build.test.ts:112-129`; plan Task 1, Step 4 and Testing Strategy | Update Task 1, Step 4 to the `realpathSync` form and the Testing Strategy count to 8, in the worktree before the squash-merge. |

Status of the first review's findings: the Warning (orphaned TypeScript 7 compiler on Node 22.0 to 22.14 after `SIGTERM`) was **moved to Risk** (plan Risk, "On Node 22.0 to 22.14 ..."), so it is not a finding here. The Suggestion (duplicated static-file regex) was **resolved**: `scripts/copy-static.mjs:25` exports `STATIC_FILE`, used at `scripts/copy-static.mjs:41` and `scripts/watch.mjs:38`.

## Dual-Perspective Analysis

**Arguments this is sound:**

| Aspect | Evidence | Strength |
|---|---|---|
| One owner of non-`tsc` output, now including the file-type list: `build` and `watch` both call `copyStatic()`, and the watcher filters on the same `STATIC_FILE` | `scripts/copy-static.mjs:25,31-45`; `scripts/watch.mjs:7,13,28,38` | Strong |
| The symlink fix treats the root cause: Node resolves symlinks for the main module's `import.meta.url`, so the check now resolves `argv[1]` the same way, instead of adding a second entry path | `scripts/copy-static.mjs:47-48`; pinned end to end by spawning the script through a real symlink in `test/build.test.ts:112-129` | Strong |
| The symlink test restores `dist/manifest.json` in `finally`, and no other test file reads `dist/` (only `test/build.test.ts` does; `node:test` runs a file's top-level tests in order), so the temporary delete cannot break a neighbour | `test/build.test.ts:119-127`; `grep -rn manifest.json test src` finds no other reader | Moderate |
| Watch start-up order means a watch that cannot start leaves no `tsc` behind, and a later watch error stops `tsc` and exits 1 rather than leaving a half-working watch | `scripts/watch.mjs:34-47,62-69`; exit code path at `scripts/watch.mjs:53` (`stopping` stays false, `code` is `null`, exits 1) | Moderate |
| Fallbacks do not hide failures: the first copy exits 1, only the debounced re-copy logs and continues (spec step 5), `package.mjs` exits 1 on every spawn error or non-zero status | `scripts/watch.mjs:12-17,26-32`; `scripts/package.mjs:26-30` | Strong |
| No orphaned callers. The fix round renamed nothing; `STATIC_FILE` is a new export. Text search (no symbol tool was available) for `copy-static`, `STATIC_FILE` and `copyStatic` finds only the expected users | `package.json` `build` script; `scripts/watch.mjs:7`; `scripts/copy-static.mjs` | Moderate |
| The suite is green at the branch head: 27 pass, 0 fail, 0 skipped | `pnpm test` run in this review | Strong |

**Arguments this has problems:**

| Aspect | Evidence | Severity |
|---|---|---|
| Plan text drift after the fix round (main-module check, test count) | plan Task 1, Step 4; Testing Strategy; `scripts/copy-static.mjs:48` | Low |

## Not Applicable

None.

## Needs Investigation

- **The manual Chrome check is still not run.** The spec's seven-step watch check and loading the `pnpm package` zip with "Load unpacked" need a browser. They confirm that Chrome accepts a `dist/manifest.json` whose version came from `package.json` and shows the icons. The user's end-of-branch manual check resolves this.
- **The watcher `error` handler path was not exercised in this review either.** The plan's **Risk** already records that it cannot be triggered on Linux by removing `src/`, so this is a known limit, listed only so that the reader knows it was not run.

## Reasoning

All five dimensions applied. The change solves the four stated gaps at the right layer, and the fix round made it more coherent rather than adding patches: the regex now has one owner, the symlink fix matches how Node itself resolves the main module, and the watch start-up order removes the orphaned-`tsc` case on a failed start. The first review's Warning is now a recorded known limit in **Risk** and so no longer a finding. What remains is one Suggestion about the plan's own text, which does not affect behaviour.

## Verdict

**Assessment:** Sound
**Confidence:** High — I read every touched script in full, ran `pnpm test` at the branch head (27 pass), and checked each first-review finding against the code and the plan's **Risk**.
**Recommendation:** Optionally update the plan's Task 1, Step 4 and its test count, then have the user run the spec's manual Chrome check before the squash-merge.
