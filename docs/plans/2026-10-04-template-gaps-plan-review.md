# Review: docs/plans/2026-10-04-template-gaps.md

**Status:** review of docs/plans/2026-10-04-template-gaps.md, 2026-10-04. Mixed: the plan is ready apart from two fixable gaps, and the top one is that Task 5, Step 2 uses a bare `wait`, which always returns 0, so its exit-code check cannot fail. Answered in the plan: both findings are fixed (`wait "$pid"` in Task 5, and `pnpm install --frozen-lockfile` after the worktree is created).

## Change Summary

The plan implements the template-gaps spec in five tasks. Task 1 moves the version source to `package.json`, written by an exported `copyStatic()`. Task 2 adds four placeholder PNG icons and copies `.png` files. Task 3 limits the content script to `https://example.com/*`. Task 4 adds `scripts/package.mjs`, which zips `dist/` with the system `zip`. Task 5 adds `scripts/watch.mjs`, which runs `tsc --watch` and re-runs `copyStatic()`. Tasks 1 to 4 are test-first with named red steps. Task 5 uses scripted manual checks, as the spec decides.

## Grounding

The caller sweep was text-only (`grep`, `cat`). There was no symbol-reference tool. The plan renames or removes no cross-file symbol: `copyStatic()` is new, and `scripts/copy-static.mjs` has a single caller, the `build` script (`package.json:11`).

Claims that hold:

- `scripts/copy-static.mjs:16` copies `manifest.json` unchanged, and `:19` filters on `/\.(html|css)$/`. This matches Task 1, Step 4 and Task 2, Step 6.
- `manifest.json:4` holds `"version": "0.1.0"`, and `:11` holds `"matches": ["https://*/*"]`. So the stated red steps for tests 2 and 4 hold, and test 1 passes today, as the plan says.
- `test/build.test.ts:2,3,5` already import `existsSync`, `readFileSync`, `join` and `fileURLToPath`, which the Task 1 to 3 snippets use. Task 4, Step 1 lists the imports it adds. `test/build.test.ts:8` uses the same `../../` depth as the plan's `root`.
- "19 old tests": `test/build.test.ts` has 6, `test/handler.test.ts` 8 and `test/settings.test.ts` 5, a total of 19.
- `package.json:12` is `"watch": "tsc -p tsconfig.json --watch"`, and `.gitignore:1-4` has no `release/`. Both match what Tasks 4 and 5 change.
- `zip`, `unzip`, `convert` and `identify` are all in `/usr/bin`. I re-ran the icon command in the scratchpad: it gives `16x16` and `128x128`, both `8-bit sRGB`. `zip -r -X` onto an existing non-zip file exits with code 3, which matches Task 4, Step 4.
- `node_modules/.bin/tsc` runs `exec node …/bin/tsc`. `node_modules/typescript/lib/tsc.js` calls `process.execve` into the native compiler on Node 22.15 or later. So `child.kill()` in `watch.mjs` reaches the real `tsc` process, not a wrapper that would be left running.

Gaps:

- Line 74 of the plan (worktree creation) ↔ `.gitignore:1` (`node_modules/`). A new worktree has no `node_modules`, and no step runs `pnpm install` (see Issues).

## Issues Surfaced

| Severity / Confidence | Issue | Evidence | Fix |
|---|---|---|---|
| Warning / High | The Task 5, Step 2 exit-code check is vacuous. With no argument, `wait` always returns 0, so `echo "exit $?"` prints `exit 0` whatever `watch.mjs` exits with. The spec's stop behaviour (spec step 6, and the plan's reading "exits with 0 when stopping") is then never checked. Step 3 has the same `wait`, but checks no exit code there. | Plan Task 5, Step 2 (`wait; echo "exit $?"`). Scratchpad check: `(sleep 1; exit 7) & wait; echo $?` printed `0`, and `wait $!` printed `7`. | Capture the job: `… node scripts/watch.mjs > /tmp/watch.log 2>&1 & pid=$!`, then `wait "$pid"; echo "exit $?"`. |
| Warning / Medium | No step installs dependencies in the new worktree. `node_modules/` is git-ignored, so in `.claude/worktrees/template-gaps` the first `pnpm test` (Task 1, Step 2) cannot find `biome` or `tsc`. Task 5's `PATH="$PWD/node_modules/.bin:$PATH"` also assumes the folder exists. The executor gets a failure that does not match the step's "Expected" line. | `.gitignore:1`; plan line 74 (worktree creation, then straight to Task 1). I could not check whether pnpm 12 installs on its own before a run. | After `git worktree add`, add `pnpm install --frozen-lockfile` (with the `fnm` prefix) as a setup step. |

## Dual-Perspective Analysis

**Arguments this is sound:**

| Aspect | Evidence | Strength |
|---|---|---|
| Each red step is real and names its message. Test 1's red comes from removing the source version before the copy writes it. Tests 3 and 4 and the package tests get deliberate breaks. | `manifest.json:4,11`; `scripts/copy-static.mjs:16`; Task 2, Step 7; Task 4, Step 4 | Strong |
| The plan's facts check out against the repo and the tools: the test count, imports, regexes, icon output and zip exit code. | `test/build.test.ts:2-8`; `scripts/copy-static.mjs:19`; scratchpad runs | Strong |
| The package tests run the real script through `process.execPath` and read the real zip. That is an end-to-end test of the new public surface, `pnpm package`, and it covers the existing-file, relative-path and missing-folder cases. | Plan Task 4, Step 1 | Strong |
| Stopping the watch reaches the real compiler, because the shim uses `exec` and TS7's `tsc.js` uses `execve`. | `node_modules/.bin/tsc` (final `exec` lines); `node_modules/typescript/lib/tsc.js` | Moderate |
| The Risk section names the host-access narrowing, its blast radius and how to reverse it, plus the known limits. | Plan "Risk"; `manifest.json:11` | Moderate |

**Arguments this has problems:**

| Aspect | Evidence | Severity |
|---|---|---|
| The watch exit-code check cannot fail. | Plan Task 5, Step 2; scratchpad `wait` check | Medium |
| The worktree setup has no dependency install. | `.gitignore:1`; plan line 74 | Medium |

## Not Applicable

None.

## Reasoning

The plan is grounded: every checkable claim about the current files, the test count, the tools, the icon command and `zip`'s exit code held against the repo or a scratchpad run. Its TDD order and red steps are correct for Tasks 1 to 4. The two findings are both Warnings, each fixed with one line. One is a vacuous exit-code check in the hand-run watch checks. The other is a missing install step that will stop the first `pnpm test` in the worktree. Neither changes the approach.

## Verdict

**Assessment:** Mixed
**Confidence:** High. Both findings were checked directly: the `wait` behaviour by running it, and the ignored `node_modules` from `.gitignore`.
**Recommendation:** Change Task 5, Step 2 to `wait "$pid"`, and add a `pnpm install --frozen-lockfile` step after the worktree is created. Then approve the plan.
