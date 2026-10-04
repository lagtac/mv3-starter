# Review: docs/plans/2026-10-04-template-gaps-spec.md

**Status:** review of docs/plans/2026-10-04-template-gaps-spec.md, 2026-10-04. Mixed: the design holds together, but two claims about today's tests are false, and the watch on single files can go silent after one save. Answered in the spec: the three editorial findings are fixed, and the watch finding became decision T6 (watch the root folder).

## Spec Summary

The spec closes four template gaps. `pnpm watch` becomes a `scripts/watch.mjs` that runs `tsc --watch` and re-runs a now-exported `copyStatic()` on static file changes. A new `scripts/package.mjs` zips `dist/` with the system `zip`. The version lives only in `package.json` and is written into `dist/manifest.json` by the copy step. Four committed placeholder PNG icons are added, and the content script match narrows to `https://example.com/*`.

## System Model

| Component | Owns | Depends on | New / existing (verified at) |
|---|---|---|---|
| `manifest.json` (source) | Every manifest field except `version`; icon paths; match pattern | none | Existing `manifest.json:1-13` (has `version` at line 4, `https://*/*` at line 11) |
| `package.json` | The one `version`; `name`; the `watch`, `package`, `build`, `clean`, `test` scripts | none | Existing `package.json:3,10-15` |
| `copyStatic()` in `scripts/copy-static.mjs` | The rule "every non-`tsc` file into `dist/`"; merging `version` into `dist/manifest.json`; copying `.html`, `.css`, `.png` | `manifest.json`, `package.json`, `src/` | Existing `scripts/copy-static.mjs:1-22` (today a top-level script, no export, copies `manifest.json` verbatim) |
| `scripts/watch.mjs` | Debounce timer; the `tsc` child process; signal handling; the decision which changes trigger a copy | `copyStatic()`, `tsc` on `PATH`, `fs.watch` | New |
| `scripts/package.mjs` | Output path choice; zip file creation; the "not built" and "no zip" messages | `package.json`, built `dist/`, system `zip` | New |
| `src/icons/*.png` | The four placeholder images | ImageMagick, once, outside the build | New |
| `test/build.test.ts` | Tests 1 to 5 | Built `dist/`, `scripts/package.mjs`, `zip`, `unzip` | Existing `test/build.test.ts:1-82` |
| `pnpm test` / `pnpm build` / `pnpm clean` | Build-then-test order; deletion of `dist/` and `.test-build/` | `tsc`, `copyStatic`, Biome | Existing `package.json:10-15` |

| From → To | What passes | Owner of what passes |
|---|---|---|
| `package.json` → `copyStatic()` | The `version` string (file read) | `package.json` |
| `manifest.json` → `copyStatic()` | Every other manifest field (file read) | `manifest.json` |
| `copyStatic()` → `dist/` | `dist/manifest.json`, `.html`, `.css`, `.png` files | `copyStatic()` |
| `tsc` → `dist/` | `.js` files | `tsc` (via `tsconfig.json:10-11`) |
| `watch.mjs` → `copyStatic()` | A function call (import); a thrown error back | `copyStatic()` owns the copy; `watch.mjs` owns when |
| `watch.mjs` → `tsc` child | Spawn, `stdio: inherit`, signals, exit code | `watch.mjs` |
| `fs.watch` → `watch.mjs` | Change events for `src/`, `manifest.json`, `package.json` | Node / the OS |
| `pnpm package` script → `clean` → `test` → `package.mjs` | Ordering via `&&` | `package.json` |
| `package.mjs` → `zip` | Spawn with `cwd` = `dist/`, absolute output path | `package.mjs` |
| `test/build.test.ts` → `package.mjs` | Spawn with a temporary output path | test 5 |

Every row could be filled from the spec. The split is clean: `copyStatic()` is the single owner of the copy rule, and both `build` and `watch` call it rather than duplicating it.

## Grounding

The sweep was text-only (`grep`, `cat`); no symbol-reference tool was available. Nothing is removed or renamed, so no name-token sweep was needed beyond reading the touched files.

- spec §Testing ("The existing test 'every file named in the manifest exists in dist/' also covers the icons once they are in the manifest") ↔ `test/build.test.ts:27-37`. False. That test lists only `background.service_worker`, `action.default_popup`, `options_page` and `content_scripts[].js`. It never reads `icons` or `action.default_icon`. The red-step reasoning for test 3 ("the existing 'every file exists' test would fail first") rests on the same false premise.
- spec §Testing, Red step ("tests 1 ... fail before the change, because the version is not written") ↔ `manifest.json:4`, `package.json:3`, `scripts/copy-static.mjs:16`. False. Today the copy step copies `manifest.json` verbatim, and both files say `0.1.0`, so `dist/manifest.json` already has the same version as `package.json`. Test 1 passes before the change.
- spec §What the user decided T2 ("`pnpm version patch` bumps the one real copy"). Holds, but incompletely: `pnpm help version` (pnpm 12.4.1) shows it also creates a git commit and tag by default, with the commit message `"%s"` (the bare version), unless `--no-git-tag-version` or `-m` is passed.
- Other claims hold: `pnpm watch` is `tsc --watch` only (`package.json:11`); `pnpm clean` deletes only `dist` and `.test-build` (`package.json:12`); `.gitignore` has no `release/` (`.gitignore:1-4`); `zip`, `unzip` and `convert` are at `/usr/bin`; Node is v22.17.0; scaffold D2 and D10 say what the spec cites (`docs/plans/2026-10-02-mv3-scaffold-spec.md:41,49`); `src/lib/handler.ts` and `src/content.ts` exist and need no change.

## Issues Surfaced

| Severity / Confidence | Class | Issue | Evidence | Fix |
|---|---|---|---|---|
| Warning / High | editorial | The spec says the existing "every file named in the manifest exists" test covers the icons. It does not: it reads four fixed fields only. | `spec §Testing` ↔ `test/build.test.ts:27-37` | Delete the sentence, and the "would fail first" clause in the red-step paragraph. Test 3 already checks that each icon file exists. |
| Warning / High | editorial | The spec says test 1 fails before the change. It passes today, because both files say `0.1.0` and the copy is verbatim. | `spec §Testing` ↔ `manifest.json:4`, `package.json:3`, `scripts/copy-static.mjs:16` | Correct the red-step claim: test 2 is what fails today; test 1 only goes red after the source `version` is removed and before the copy writes it. |
| Warning / Medium | design | `fs.watch` on the single files `manifest.json` and `package.json` follows the file's inode on Linux. Editors that save by writing a new file and renaming it (vim's default, many IDEs) replace the inode, so the watch fires once and then goes silent. Manual check step 5 (break, then fix `manifest.json`) is exactly the sequence that hits this. The Risk section treats missed events as random, not as this repeatable case. | `spec §scripts/watch.mjs` step 3; `spec §Risk` (second bullet) | Decision for the author: for example, watch the repo root non-recursively and filter by file name, or name this case as a known limit. |
| Warning / Medium | editorial | T2 tells the user to run `pnpm version patch`, which by default commits with the bare version as the message and creates a tag. That breaks the project's Conventional Commits rule and refuses to run on a dirty tree. | `spec §What the user decided` T2; `pnpm help version` (pnpm 12.4.1) | Name the command in full, such as `pnpm version patch --no-git-tag-version`, or `-m "chore(manifest): release %s"`. |

## Dual-Perspective Analysis

**Arguments this is sound:**

| Aspect | Evidence | Strength |
|---|---|---|
| Boundaries | `copyStatic()` stays the single owner of the copy rule; `build` and `watch` both call it (`spec §scripts/copy-static.mjs`, `§scripts/watch.mjs`) | Strong |
| Contracts and flow | Version has one source (`package.json`); `dist/manifest.json` is derived; test 2 pins the source manifest with no version | Strong |
| Failures and interactions | Error table covers invalid JSON, missing `tsc`, missing `zip`, unbuilt `dist/`, failing tests; watch survives copy errors; `package` cleans and tests first (`spec §Error handling`, `§scripts/package.mjs`) | Strong |
| Fit with what exists | No bundler and no new dependency, consistent with scaffold D2 (`docs/plans/2026-10-02-mv3-scaffold-spec.md:41`); rejected options (sync test, `fflate`, `concurrently`, SVG source) are real, each with a stated cost | Strong |
| Spec rules | "How to read this spec" is first; Trade-offs, Dependencies and Risk are present; icon change is covered under D10 with a Visual Language note | Moderate |

**Arguments this has problems:**

| Aspect | Evidence | Severity |
|---|---|---|
| Grounding | Two false claims about current test behaviour (`test/build.test.ts:27-37`; `manifest.json:4` vs `package.json:3`) | Medium |
| Failures and interactions | Single-file `fs.watch` goes silent after an atomic save; the manual check exercises that path | Medium |
| Fit with project rules | `pnpm version patch` default commit message breaks Conventional Commits | Low |

## Not Applicable

None.

## Needs Investigation

- **Does the narrowed pattern still trigger the broad-host warning in a way the spec expects?** The spec quotes the Web Store warning text for `https://*/*`. I could not check Chrome's warning text offline. It does not change the decision, only the stated reason. Loading the extension in Chrome, or reading the permission-warnings page, would settle it.

## Reasoning

The System Model has no gaps: every component has one job, and the version has a single source of truth with a derived copy. The findings are two false statements about how today's tests behave, one design gap in how `watch.mjs` watches single files, and one incomplete command in T2. None of them challenges the chosen options or the scope, so the approach is right and needs fixes, not rework.

## Verdict

**Assessment:** Mixed
**Confidence:** High — every surfaced claim was checked against the repo files or the installed pnpm.
**Recommendation:** Fix the two Testing-section claims and the T2 command wording. Ask the user how `watch.mjs` should watch `manifest.json` and `package.json`, then continue to the plan.
