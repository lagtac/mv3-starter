# Review: docs/plans/2026-10-02-mv3-scaffold.md

**Status:** review of docs/plans/2026-10-02-mv3-scaffold.md, 2026-10-02. Sound: every snippet, red step and test count reproduced in a scratch run with the pinned toolchain. The only finding is a Suggestion: the restore in Task 3, Step 9 deletes by line position, so it can delete the closing brace of `content.ts`. The plan now removes the added line by its text; the finding is answered.

## Change Summary

The plan builds the Chromium-only MV3 scaffold from the approved spec in four tasks. Task 1 sets up the toolchain, the shared types and the counter handler. Task 2 adds the greeting settings. Task 3 adds the manifest, the static-copy build step, the service worker and the content script. Task 4 adds the popup and the options page. Each task runs as stub → failing test → implementation → passing `npm test` → commit. Three checks with no natural red step get a deliberate break and a restore (Task 3, Step 9; Task 4, Steps 10 and 11).

## Grounding

The repo has no symbol-reference tool here, so every search below was text-only (`grep`, `find`, `sed`). Reference completeness does not apply: every file in the plan is new, and nothing is removed or renamed (plan:56). The repo holds only `CLAUDE.md`, `.markdownlint-cli2.jsonc` and `docs/plans/`, as the plan's Context says (plan:45).

**Simulation.** I extracted the plan's code blocks by line range into a scratch project (`/tmp/claude-1000/-home-dchris-projects-play-ext/e2533b4b-7821-4c17-affd-0ebf0a0bbfc4/scratchpad/sim`). I installed exactly the three dev dependencies with the plan's command (plan:123). `npx tsc --version` printed `Version 7.0.2`, and Node is `v22.17.0`. Then I ran each step in order:

| Plan step | Plan expects | Observed |
|---|---|---|
| Task 1, Step 10 (red) | `# fail 8`, each with `'not implemented'` (plan:305) | `# pass 0`, `# fail 8`, 8 × `error: 'not implemented'` |
| Task 1, Step 12 | `# pass 8`, `# fail 0` (plan:351) | same |
| Task 2, Step 3 (red) | `# pass 8`, `# fail 5` (plan:456) | same |
| Task 2, Step 5 | `# pass 13` (plan:501) | same |
| Task 3, Step 5 (red) | `# fail 2`, `dist/background.js is missing`, `dist/content.js is missing` (plan:631) | same, `# pass 13` |
| Task 3, Step 8 | `# pass 15`; `content.js` starts `"use strict";`, no `export {};` (plan:665) | same |
| Task 3, Step 9 (break) | `# fail 1`, `content.js runs as a classic script` (plan:673) | same; restore gives `# pass 15` |
| Task 4, Step 2 (red) | `# fail 2` on the manifest and two-pages tests (plan:752) | same, `# pass 17` |
| Task 4, Step 9 | `# pass 19` (plan:913) | same |
| Task 4, Step 10 (break) | `popup/popup.html: <script src="popup.js">`, `# fail 1` (plan:919) | same |
| Task 4, Step 11 (break) | `options/options.html points to missing dist/options/popup.css`, `# fail 1` (plan:927) | same; restore gives `# pass 19` |

Other claims checked:

- The final `manifest.json` (plan:759-771) matches the spec's manifest (`docs/plans/2026-10-02-mv3-scaffold-spec.md:143-155`). The two differ only in the code fences.
- The spec's tsconfig settings (spec:104-112), test command (spec:296), storage keys (spec:190, 226), UI texts (spec:228, 247, 254) and test list (spec:298-315) all appear in the plan (plan:21-28, 243-298, 404-449, 582-745).
- `background.ts` passes `chrome.storage.session` as `Store`, and `popup.ts`/`options.ts` pass `chrome.storage.sync` as `Store`. Both type-checked under `@types/chrome` 0.3.4 (Step 9 of Task 4 compiled).
- The plan fills two gaps in the spec, both stated openly: `"include": ["src"]` (plan:51) and `.claude/worktrees/` in `.gitignore` (plan:52, spec:88). The plan also records two readings of the spec rather than asking about them (plan:38, 849, 984). These fill gaps the spec leaves open; none reverses a decision the spec made, so none is a silent reinterpretation.
- The plan names the spec review as `docs/plans/2026-10-02-mv3-scaffold-spec-review.md` (plan:13), which exists. An untracked file, `docs/plans/2026-10-02-mv3-scaffold-spec-review2.md`, holds only a 5-line table listing. The plan does not reference it, and it does not bear on the plan.

No stale reference or false assumption was found.

## Issues Surfaced

| Severity / Confidence | Issue | Evidence | Fix |
|---|---|---|---|
| Suggestion / High | The Task 3, Step 9 restore deletes by position (`sed -i '$d'`). If `src/content.ts` has no trailing newline, `echo 'export {};' >>` produces `}export {};` on the last line. The restore then deletes the closing brace with it, and the build fails with `TS1005: '}' expected`. The plan's `tail -1` check catches this. But the file is not committed yet, so recovery means rewriting it from Step 7. | `docs/plans/2026-10-02-mv3-scaffold.md:671-675`; reproduced in the scratch copy `sim-t3` | Make the restore match by pattern, not by position, like the substitution pairs in Task 4, Steps 10 and 11. For example: `printf '\nexport {};\n' >> src/content.ts`, then `sed -i '/^export {};$/d' src/content.ts`. |

## Dual-Perspective Analysis

**Arguments this is sound:**

| Aspect | Evidence | Strength |
|---|---|---|
| Every red step fails for the stated reason, and every green count matches | Grounding table above; plan:305, 456, 631, 752 | Strong |
| The three checks with no natural red step get a deliberate break, and each break produced the exact message the plan names | plan:667-675, 915-929 | Strong |
| The stub-first pattern makes red steps fail on assertions, not on a missing module | plan:190, 942-945 | Strong |
| Each commit is green: the manifest is split across Tasks 3 and 4 so Task 3 can commit with passing tests | plan:561-563, 947-949 | Strong |
| Tests cover inputs the spec's test list skips (malformed objects, `set` rejection, non-`Error` rejection, invalid saved greeting), each tied to a named test | plan:33-39, 267-298, 419-427 | Strong |
| The final manifest matches the spec byte for byte, apart from the code fences | plan:759-771 ↔ spec:143-155 | Strong |
| The Risk section names known limits (stale `dist/`, regex HTML checks, the lost-increment race, untested UI wiring) with detection | plan:960-971 | Moderate |

**Arguments this has problems:**

| Aspect | Evidence | Severity |
|---|---|---|
| Position-based restore in a deliberate-break step | plan:675 | Low |

## Not Applicable

None.

## Needs Investigation

- **The extension in a real browser.** Spec success criterion 2 (spec:32) says "Load unpacked" accepts `dist/` with no errors, and the demo flow (spec:256-264) shows the parts working together. Neither can be checked here. Type-checking `chrome.storage.session` as `Store`, and checking files in `dist/`, does not prove that Chrome loads the extension or that the message wiring works at runtime. This matters because `background.ts`, `popup.ts` and `options.ts` have no automated tests (plan:969). How to resolve it: the user runs the manual end-of-branch check that the plan already assigns (plan:980).

## Reasoning

Grounding was done by running the plan, not only by reading it. Every count, failure message and deliberate break matched the plan's text under the pinned toolchain, and the final manifest matches the spec. Sequencing keeps every commit green, the red steps fail for the right reason, and the tests pin both the spec's list and the extra edge cases the plan adds. The one finding is a fragile restore command whose failure the plan already detects. It cannot leave a wrong result committed, so it is a Suggestion.

## Verdict

**Assessment:** Sound
**Confidence:** High — every snippet and every expected test count reproduced with typescript 7.0.2, @types/chrome 0.3.4, @types/node 22.20.5 and Node 22.17.0.
**Recommendation:** Optionally switch the Task 3, Step 9 restore to a pattern-based delete, then commit the plan with this review and hand it to the code stage. After the merge, the user runs the manual "Load unpacked" and demo-flow check.
