# Review: main..feat/template-gaps

**Status:** review of main..feat/template-gaps, 2026-10-04. Mixed: the approach is right and matches the plan task for task; the top finding is that `pnpm watch` can leave an orphaned `tsc` compiler on Node 22.0 to 22.14, which `engines` still allows.

## Change Summary

The branch makes `scripts/copy-static.mjs` export `copyStatic()`, which writes `dist/manifest.json` with the `package.json` version and also copies `.png` files. It adds `scripts/watch.mjs` (runs `tsc --watch` and re-runs `copyStatic()` on static file changes) and `scripts/package.mjs` (zips `dist/` with the system `zip`), four placeholder icons, and a content-script match narrowed to `https://example.com/*`. Seven new tests in `test/build.test.ts` cover the version, the icons, the match rule and the package script.

## Plan Alignment

The implementation matches the plan. Each of the five tasks maps to one change, the script lines, messages, match pattern, icon keys, zip path and debounce match the Global Constraints, and the seven tests are the plan's code. Deviations:

- `test/build.test.ts:3`: the plan's Task 4, Step 1 lists `mkdirSync` among the imports; the diff leaves it out. It is unused, so leaving it out is correct (Biome would flag it). Not a finding.
- `scripts/package.mjs:29`: on a spawn error other than `ENOENT`, the script prints `result.error.message` before exiting 1. The plan only says "exit 1". This adds a message; it does not change the contract. Not a finding.

No plan item is missing from the diff. The plan's manual Chrome check (Testing Strategy, end-of-branch) is outside the diff and still to be run by the user.

## Issues Surfaced

| Severity / Confidence | Issue | Evidence | Fix |
|---|---|---|---|
| Warning / Medium | On Node 22.0 to 22.14, `child.kill()` stops only the TypeScript 7 launcher, not the native compiler it starts, so a `SIGTERM` to `pnpm watch` (not a terminal Ctrl+C, which signals the whole group) leaves a `tsc --watch` process writing to `dist/`. The launcher uses `process.execve` only when it exists (Node 22.15+) and otherwise falls back to `execFileSync`. `engines` still allows `>=22`. The plan's scripted check ran on 22.17, so it could not see this. | `scripts/watch.mjs:20`, `scripts/watch.mjs:28-33`; `node_modules/typescript/lib/tsc.js:8-20`; `package.json` `"engines": { "node": ">=22" }` | Record it in the plan's **Risk** as a known limit (this machine runs 22.17, so today's setup never hits it). Raising `engines` to `>=22.15` would change the plan's Global Constraint that `">=22"` stays, so that is the user's decision, not a reviewer fix. |
| Suggestion / High | The static-file extension list exists twice. The plan's Architecture makes `copyStatic()` "the one owner of every file `tsc` does not produce", but `watch.mjs` repeats the regex. Adding, say, `.svg` to the copy without the watcher would build it but never refresh it during watch. | `scripts/copy-static.mjs:31`, `scripts/watch.mjs:52` | Export the pattern (for example `STATIC_FILE`) from `copy-static.mjs` and import it in `watch.mjs`. |

## Dual-Perspective Analysis

**Arguments this is sound:**

| Aspect | Evidence | Strength |
|---|---|---|
| One owner for non-`tsc` output: `build` and `watch` both call `copyStatic()`; no second copy path | `scripts/copy-static.mjs:21-37`, `scripts/watch.mjs:12-17`, `scripts/watch.mjs:42-48` | Strong |
| One version source, pinned by a test in both directions (dist carries it; source lacks it) and checked against Chrome's version format | `scripts/copy-static.mjs:27`, `test/build.test.ts:93-106` | Strong |
| Root-folder watch, not file watch, handles rename-saves (spec T6) | `scripts/watch.mjs:56-58` | Strong |
| Package script handles the stated edge cases (stale file, relative path, missing folder), each with its own end-to-end test that spawns the real script and reads the real zip | `scripts/package.mjs:20-23`, `test/build.test.ts:158-188` | Strong |
| Match test pins a rule, not a value, so a template user can change the domain | `test/build.test.ts:127-135` | Moderate |
| No orphaned callers: the only removed top-level behaviour (verbatim manifest copy) is replaced in place; text search finds no other reference to the old match pattern, the old watch command or a manifest `version` | `grep -rn` for `copy-static`, `https://*/*`, `tsc -p tsconfig.json --watch` and `"version"`: no hits outside `docs/plans/` except the new `scripts/watch.mjs:7` import and `test/build.test.ts:105` | Moderate |
| No new npm dependency; `zip` and the icons are system or one-off tools, as T3 and T4 decided | `package.json` `devDependencies` unchanged | Moderate |

**Arguments this has problems:**

| Aspect | Evidence | Severity |
|---|---|---|
| Watch stop path depends on the Node minor version through the TypeScript 7 launcher | `scripts/watch.mjs:28-33`, `node_modules/typescript/lib/tsc.js:8-20` | Medium |
| Extension list duplicated between the copy and the watcher | `scripts/copy-static.mjs:31`, `scripts/watch.mjs:52` | Low |

## Not Applicable

None.

## Needs Investigation

- **The manual Chrome check has not been run in this review.** The spec's seven-step watch check and loading the `pnpm package` zip in Chrome cannot be done offline. They confirm that Chrome accepts `dist/manifest.json` without a source `version` and shows the icons. The user's end-of-branch manual check resolves this.

## Reasoning

All five dimensions applied. The change solves the four stated gaps at the right layer: `copyStatic()` stays the single producer of non-`tsc` files, the scripts are thin, and no fallback hides a failure (the watch-time `catch` at `scripts/watch.mjs:45-47` is the spec's step 5, logging and waiting for the next save). The caller sweep was a text search (`grep -rn`, no symbol tool available) for `copy-static`, `https://*/*`, `tsc -p tsconfig.json --watch` and `"version"`; it found no orphaned reference outside the plan documents. The diff matches the plan task by task. What remains is one Warning: the stop path of `pnpm watch` depends on the Node minor version, which `engines` does not pin. There is also one Suggestion about a duplicated regex.

## Verdict

**Assessment:** Mixed
**Confidence:** High — I read every touched file in full, plus the TypeScript 7 launcher that decides how `child.kill()` behaves; the one Warning is about a Node version range, not the approach.
**Recommendation:** Add the Node 22.0 to 22.14 watch limit to the plan's **Risk** (raising `engines` is a plan change for the user to decide), optionally export the static-file pattern, then have the user run the spec's manual Chrome check before the squash-merge.
