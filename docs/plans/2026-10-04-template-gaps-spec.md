# Template gaps — spec

**Status:** draft, 2026-10-04.

**Path:** architectural (size Large, because the content script's host access changes). Brainstormed without `my:architect`: no data model, storage choice or public contract changes.

## How to read this spec

Read in this order:

1. This spec: `docs/plans/2026-10-04-template-gaps-spec.md`.
2. The spec review, once written: `docs/plans/2026-10-04-template-gaps-spec-review.md`.
3. The implementation plan, once written: `docs/plans/2026-10-04-template-gaps.md`.
4. Background: the scaffold spec, `docs/plans/2026-10-02-mv3-scaffold-spec.md`. It explains the `tsc`-only build (decision D2), the copy script and the content script rule. This spec does not change any of those.

There is no architecture brief, roadmap or changelog.

External references used:

- Manifest `icons` and `action.default_icon`: <https://developer.chrome.com/docs/extensions/reference/manifest/icons>
- Match patterns: <https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns>
- Web Store zip layout (manifest at the top level): <https://developer.chrome.com/docs/webstore/publish>
- Node `fs.watch` (recursive on Linux since Node 20): <https://nodejs.org/docs/latest-v22.x/api/fs.html#fswatchfilename-options-listener>

## Goal

Close four gaps that stop this repo from serving as a starter template for small Chromium extensions. The item numbers come from a list of seven gaps found when judging the repo as a template; this spec fixes four of them.

- **Item 1: `pnpm watch` is incomplete.** Today it runs only `tsc --watch`. It never copies `manifest.json`, HTML or CSS, so a fresh clone gets a `dist/` that Chrome cannot load.
- **Item 2: there is no packaging step.** The Chrome Web Store needs a zip file and a 128×128 icon. The manifest has no icons.
- **Item 3: the version lives in two places.** `package.json` and `manifest.json` both say `0.1.0`, and nothing keeps them in sync.
- **Item 5: the content script runs on every HTTPS site.** `"matches": ["https://*/*"]` makes the Web Store warn users that the extension can "read and change all your data on all websites".

Items 4 (message types that do not scale) and 6 (no shared runtime code in the content script) are out of scope. They wait until a second feature needs them.

Success means:

1. On a fresh clone, `pnpm install && pnpm watch` produces a `dist/` that "Load unpacked" in `chrome://extensions` accepts with no errors.
2. While `pnpm watch` runs, an edit to `src/popup/popup.css` reaches `dist/` without any other command.
3. `pnpm package` produces `release/play-ext-<version>.zip` with `manifest.json` at its top level.
4. The version appears only in `package.json`, and `dist/manifest.json` carries it.
5. The content script runs on `https://example.com/*` only.
6. `pnpm test` passes, including the new tests listed under "Testing".

### What the user decided

| ID | Decision | Answer |
|---|---|---|
| T1 | Content script sites | `https://example.com/*` only. A real, stable site to test against; a template user replaces it. |
| T2 | Version source | `package.json` only. The copy script writes it into `dist/manifest.json`. `pnpm version patch --no-git-tag-version` bumps the one real copy. Without that flag, `pnpm version` also makes a git commit whose message is the bare version, which breaks the Conventional Commits rule, and a tag. The bump then goes into a normal commit. |
| T3 | Zip tool | The system `zip` command. No zip writer in `scripts/`, no npm dependency. |
| T4 | Icons | Four committed placeholder PNGs (16, 32, 48, 128), made once with ImageMagick. Not generated at build time. |
| T5 | Watch | A new `scripts/watch.mjs` that runs `tsc --watch` and re-runs the copy step on static file changes. No `concurrently` dependency. |
| T6 | Watching the root files | Watch the repo root folder and filter for `manifest.json` and `package.json`, not a watch on each file. A file watch goes silent after an editor saves by rename. (After the spec review.) |

### Assumptions

- The project stays `tsc` only, with no bundler (scaffold decision D2 stands).
- No new npm dependencies.
- The developer machine is Linux or macOS, with `zip` and `unzip` installed. `zip` is at `/usr/bin/zip` on this machine.
- No design canvas for the icons. They are placeholders, a plain colored square with the letter "P", meant to be replaced. This follows the scaffold's decision D10.

## Architecture

### File layout after the change

New files are marked `new`; changed files are marked `changed`.

```text
manifest.json              changed: no version; icons; action.default_icon; narrow match
package.json               changed: watch and package scripts
.gitignore                 changed: release/
scripts/
  copy-static.mjs          changed: exports copyStatic(); writes version; copies .png
  watch.mjs                new
  package.mjs              new
src/
  icons/
    icon-16.png            new
    icon-32.png            new
    icon-48.png            new
    icon-128.png           new
test/
  build.test.ts            changed: new tests
release/                   new, git-ignored: built zips
```

### `scripts/copy-static.mjs`

The script keeps its job: put every file that `tsc` does not produce into `dist/`. It changes in three ways.

1. **It exports `copyStatic()`.** The function takes no arguments and returns nothing. It throws on any error, such as invalid JSON in `manifest.json`. When the script is run directly, as `pnpm build` does, it calls `copyStatic()` itself. It detects this by comparing `import.meta.url` with the URL of `process.argv[1]`.
2. **It writes the version.** It reads `manifest.json` and `package.json`, sets the manifest's `version` to the package's `version`, and writes the result to `dist/manifest.json` with 2-space indentation and a final newline. The manifest's other fields keep their order, and `version` is added at the end.
3. **It copies `.png` files** from `src/`, as well as `.html` and `.css`. Each file keeps its path relative to `src/`, so `src/icons/icon-16.png` becomes `dist/icons/icon-16.png`.

### `scripts/watch.mjs`

`package.json` sets `"watch": "node scripts/watch.mjs"`. In order, the script:

1. Calls `copyStatic()` once, so a fresh clone gets a complete `dist/`. If this throws, the script prints the error and exits with code 1.
2. Starts `tsc -p tsconfig.json --watch` as a child process with `stdio: "inherit"`, so its output goes to the same terminal. It finds `tsc` on the `PATH`, which `pnpm run` sets to include `node_modules/.bin`. If the spawn fails because `tsc` is not found, the script prints "Run this through pnpm watch" and exits with code 1.
3. Starts two `fs.watch` watchers: one on `src/` (recursive) and one on the repo root folder (not recursive). A change to a `.html`, `.css` or `.png` file under `src/` schedules a copy. On the root watcher, only a change whose name is `manifest.json` or `package.json` schedules a copy. `.ts` changes are left to `tsc`. The script watches the root folder, not the two files, because many editors (vim by default) save by writing a new file and renaming it over the old one. On Linux, a watch on a single file follows the old file and sees nothing after the first such save. A folder watch sees the rename (decision T6, after the spec review).
4. Runs `copyStatic()` 100 ms after the last scheduled change. One save often fires several events, and this waits for them to stop.
5. Catches a copy error, prints it, and keeps running. For example, a half-typed `manifest.json` is not valid JSON, and the next save fixes it.
6. On `SIGINT` (Ctrl+C) or `SIGTERM`, stops the `tsc` child and exits. When the `tsc` child exits on its own, the script exits with the child's exit code.

### `scripts/package.mjs`

`package.json` sets `"package": "pnpm clean && pnpm test && node scripts/package.mjs"`. Cleaning first means no stale file left by `watch` reaches the zip. Testing first means a broken build is never packaged.

The script:

1. Reads `name` and `version` from `package.json`.
2. Takes an optional output path as its first argument. Without one, it writes `release/<name>-<version>.zip`, for example `release/play-ext-0.1.0.zip`. It creates the output folder if needed.
3. Deletes an existing file at the output path. Without this, `zip` adds files into the old archive instead of replacing it.
4. Runs `zip -r -X <absolute output path> .` with `dist/` as the working folder. This puts `manifest.json` at the top of the zip, as the Web Store requires. `-X` leaves out Unix file attributes the store does not need.
5. Prints the output path on success.
6. On failure, exits with code 1. If `zip` is not installed (the spawn fails with `ENOENT`), it prints "The zip command is not installed. Install it, or zip the contents of dist/ by hand." If `dist/manifest.json` is missing, it prints "dist/ is not built. Run pnpm build first."

`.gitignore` adds `release/`. `pnpm clean` does not delete `release/`, so earlier zips stay.

### Manifest

```json
{
  "manifest_version": 3,
  "name": "Play Ext",
  "description": "A Manifest V3 learning playground.",
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "permissions": ["storage"],
  "background": { "service_worker": "background.js", "type": "module" },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png"
    }
  },
  "options_page": "options/options.html",
  "content_scripts": [
    { "matches": ["https://example.com/*"], "js": ["content.js"], "run_at": "document_idle" }
  ]
}
```

The source has no `version`, so Chrome cannot load the repo root. It never could: Chrome loads `dist/`, which has no `.js` files until `tsc` runs.

`action.default_icon` uses the 16 and 32 sizes, the sizes Chrome shows in the toolbar. `icons` lists all four: 48 for the extensions page, 128 for the Web Store and install dialog.

### Icons

Four PNG files in `src/icons/`, each a square of its stated size: a solid fill with a white "P" in the middle. They are made once with ImageMagick (`convert`) and committed. The exact command goes in the plan. The build only copies them.

## Error handling

| Failure | Where | What happens |
|---|---|---|
| Invalid JSON in `manifest.json` or `package.json` | `copyStatic()` | Throws. `pnpm build` fails with the parse error. `watch` prints it and waits for the next save. |
| `tsc` compile error during watch | `tsc --watch` child | `tsc` prints the error and keeps watching, as today. |
| `tsc` not on the `PATH` (script run with plain `node`, not `pnpm watch`) | `watch.mjs` | The spawn fails. The script prints "Run this through pnpm watch" and exits with code 1. |
| `zip` not installed | `package.mjs` | Message from step 6 above; exit code 1. |
| `dist/` not built | `package.mjs` | Message from step 6 above; exit code 1. |
| Tests fail | `pnpm package` | `pnpm test` fails, so `package.mjs` never runs. |

## Visual Language

There is no new screen. The only visual change is the icon, which is a placeholder (see Assumptions). The popup and options page do not change.

## Testing

All new tests go in `test/build.test.ts`. They run against the real `dist/` that `pnpm test` builds just before them, like the existing build tests.

1. **The version comes from `package.json`.** `dist/manifest.json` has the same `version` as `package.json`.
2. **The source manifest has no version.** `manifest.json` at the repo root has no `version` key. This stops someone from adding a second copy back.
3. **Every icon exists and has the right size.** For each key in `icons` and `action.default_icon`, the named file exists in `dist/` and starts with the PNG signature. Its width and height, read from bytes 16 to 23 of the file (the PNG header), both equal the key. Reading the header needs no library.
4. **No content script runs on every site.** No match pattern is `<all_urls>`, and no pattern's host (the part between `://` and the next `/`) is `*`. A subdomain wildcard such as `*.example.com` is allowed. The test does not require `example.com`, so a template user can change the domain without breaking it.
5. **The package script writes a usable zip.** The test runs `node scripts/package.mjs <temporary path>` with `process.execPath`. Then `unzip -Z1 <path>`, which lists one file name per line, includes `manifest.json` (at the top level, with no folder) and `content.js`. The test is skipped, with a reason, when `zip` or `unzip` is not on the `PATH`. It writes to a temporary folder, never to `release/`.

The existing test "every file named in the manifest exists in dist/" does not cover icons. It checks only the service worker, the popup, the options page and the content script files (`test/build.test.ts:27-37`). So test 3 checks that each icon exists, and that the manifest names at least one icon.

**Red step for each test:** tests 2, 3, 4 and 5 fail today: the source manifest has a version, the manifest names no icons, the match pattern is `https://*/*`, and `package.mjs` does not exist. Test 1 passes today, because the copy step copies `manifest.json` unchanged and both files say `0.1.0`. It goes red once `version` is removed from `manifest.json` and before the copy step writes it. Test 3 needs a second deliberate break, because "no icons" is not the same failure as "wrong size": an icon of the wrong size must make it fail.

**Checked by hand, not by tests:** `watch.mjs`. A test would have to start a long-running process and edit files while it runs, which tends to fail at random. The manual check:

1. Delete `dist/`, then run `pnpm watch`.
2. Load `dist/` in `chrome://extensions`. Chrome accepts it, and the toolbar shows the "P" icon.
3. Change the color in `src/popup/popup.css`, then reopen the popup. The new color shows.
4. Change `version` in `package.json`. `dist/manifest.json` shows the new version within a second.
5. Break `manifest.json` (delete a brace) and save. The watch prints a parse error and keeps running. Fix it and save; the copy runs again.
6. Press Ctrl+C. Both the script and `tsc` stop.
7. Open `https://example.com`, then the popup: the count goes up. Open another HTTPS site: the count does not change.

`pnpm package` is also run once by hand, and its zip is loaded in Chrome by unzipping it and using "Load unpacked".

## Trade-offs

- **Version in `package.json` vs in both files vs in `manifest.json`.** `package.json` only: one source, and `pnpm version` works (with `--no-git-tag-version`); but the source manifest is not complete on its own, and the copy script edits a file instead of only copying it. Both files with a sync test: no build change; but every release needs two edits. `manifest.json` only: no build change; but `pnpm version` stops working. **Chosen:** `package.json` (T2).
- **System `zip` vs a zip writer in `scripts/` vs an npm package.** The system command is one line, but fails on a machine without it, such as plain Windows. A writer on Node's `zlib` works everywhere, but is about 60 lines of file-format code to own. A package such as `fflate` works everywhere with little code, but is a new dependency. **Chosen:** system `zip` (T3), with a clear message when it is missing.
- **Committed PNGs vs an SVG source built at build time vs one 128 PNG.** Committed PNGs need no build tool, but changing the icon means replacing four files. An SVG source means one file to edit, but every build needs ImageMagick. One 128 PNG is simplest, but Chrome scales it down and small sizes look blurry. **Chosen:** committed PNGs (T4).
- **`watch.mjs` vs `pnpm build && tsc --watch` vs `concurrently`.** The script fixes the whole gap in about 30 lines. The one-line change fixes the fresh clone, but static edits still need `pnpm build`. `concurrently` is a common pattern, but a new dependency for something Node does itself. **Chosen:** `watch.mjs` (T5).
- **A test for the match pattern vs no test.** The test pins a rule ("no all-sites pattern"), not a value, so it stays valid when a template user changes the domain. Without it, a later edit could widen the pattern again with no warning.

## Dependencies

No new npm packages.

System tools on the developer machine:

| Tool | Used by | Required? |
|---|---|---|
| `zip` | `scripts/package.mjs`, test 5 | For `pnpm package`. Test 5 is skipped without it. |
| `unzip` | test 5 | Test 5 is skipped without it. |
| ImageMagick `convert` | making the icons, once | Only to remake the icons. Not used by the build. |

Node 22 stays the minimum. Recursive `fs.watch` works on Linux from Node 20.

## Risk

- **This narrows the content script's host access.** It is the reason this change is Large. Effect: the page counter only counts visits to `https://example.com`. No published extension and no stored user data are affected, so it is easy to reverse: change one line in `manifest.json`. Blast radius: `manifest.json` only; `content.ts` and `handler.ts` do not change.
- **`fs.watch` can miss or repeat events.** Its behavior differs between operating systems. Repeats are harmless, because the copy is idempotent and debounced. A missed event leaves a stale file; detection is the page looking stale, and `pnpm build` fixes it. Known limit.
- **Watch never removes deleted files from `dist/`.** Same as `tsc --watch` today. `pnpm clean` fixes it, and `pnpm package` always cleans first. Known limit.
- **Test 5 adds a dependency on `zip` to `pnpm test`.** On a machine without it, the test is skipped, so `pnpm test` still passes but the package script goes untested. The skip reason shows in the test output.
- **`pnpm package` fails on plain Windows.** Known limit, accepted under T3. The error message says what to do.
- **The source manifest is no longer complete.** Anyone who copies `manifest.json` by hand into another folder gets a manifest Chrome rejects ("Required value 'version' is missing"). Test 2 and the Architecture section document why.

## Open questions

None.
