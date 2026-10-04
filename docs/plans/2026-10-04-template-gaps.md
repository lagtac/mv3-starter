# Template gaps Implementation Plan

**Status:** done, 2026-10-04. Shipped in dd777d4 (squash of `feat/template-gaps`); `pnpm test` 27 pass, 0 fail, 0 skipped; the manual Chrome check was not reported before the merge.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The tasks build on each other: they share one growing `test/build.test.ts` and the `copyStatic()` function, and each is small. The project's review rules in `~/.claude/CLAUDE.md` replace the skill's own reviews: no per-task reviewer, no final review pass. After each task, read `git diff` for the test files the task touched, and stop if an assertion was removed or weakened. The end-of-branch reviews run in a later session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repo a usable starter template: a complete `pnpm watch`, a `pnpm package` zip with icons, one version source, and a content script limited to one site.

**Architecture:** `scripts/copy-static.mjs` becomes the one owner of "every file `tsc` does not produce": it exports `copyStatic()`, writes the `package.json` version into `dist/manifest.json`, and copies `.png` files too. `pnpm build` runs it directly, and a new `scripts/watch.mjs` calls it on static file changes beside `tsc --watch`. A new `scripts/package.mjs` zips `dist/` with the system `zip` command.

**Tech Stack:** Node 22 (`node:fs`, `node:child_process`, `node:test`), TypeScript 7 `tsc`, Biome 2.5, system `zip` and `unzip`, ImageMagick 6 `convert` (once, for the icons).

**Spec:** `docs/plans/2026-10-04-template-gaps-spec.md`. Read it first. Its review is `docs/plans/2026-10-04-template-gaps-spec-review.md`. Background: `docs/plans/2026-10-02-mv3-scaffold-spec.md` (decision D2, `tsc` only).

**Work type:** `feat`. Branch `feat/template-gaps`, worktree `.claude/worktrees/template-gaps`.

## Global Constraints

- No new npm dependencies. `package.json` `devDependencies` stays exactly as it is. Any new package is a gate: stop and ask.
- `tsc` only, no bundler (scaffold D2). Node 22 minimum (`"engines": { "node": ">=22" }` stays).
- `node` is not on the `PATH` of a plain shell on this machine; it comes from `fnm`. Prefix every command that runs `pnpm` or `node` with `eval "$(fnm env)" &&`. Checked on 2026-10-04: `bash -c 'eval "$(fnm env)" && pnpm exec node -v'` prints `v22.17.0`.
- `pnpm test` = Biome check, then build, then the tests. It must pass at every commit. Run `pnpm fix` first when Biome reports formatting, because the new `.mjs` files and `manifest.json` are checked too.
- The version lives only in `package.json` (`"version": "0.1.0"`). `manifest.json` has no `version` key.
- `dist/manifest.json` is written with 2-space indentation and a final newline. `version` is the last key.
- Content script match: exactly `["https://example.com/*"]`.
- Icons: `src/icons/icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`. Manifest `icons` lists all four; `action.default_icon` lists 16 and 32.
- Default zip path: `release/<name>-<version>.zip`, today `release/play-ext-0.1.0.zip`. `release/` is git-ignored. `pnpm clean` does not delete it.
- Script lines in `package.json`: `"watch": "node scripts/watch.mjs"` and `"package": "pnpm clean && pnpm test && node scripts/package.mjs"`.
- Exact messages: `Run this through pnpm watch` (watch, `tsc` not found), `The zip command is not installed. Install it, or zip the contents of dist/ by hand.` and `dist/ is not built. Run pnpm build first.` (package).
- Bump the version with `pnpm version patch --no-git-tag-version`, then commit by hand.
- Commit scopes: `manifest`, `background`, `content`, `popup`, `options`, `lib`, `build`, `test`, `docs`.

## Review Focus

These inputs are implied by the spec but not named in its test list. Each one is pinned where it can be.

1. **An editor saves `manifest.json` by writing a new file and renaming it (vim's default), twice in a row.** Expected: both saves reach `dist/`. Checked by hand only, as the spec decides for `watch.mjs`: Task 5, Step 3 saves twice through `mv`. A scratch check on 2026-10-04 showed a folder watch reports `rename manifest.json` for both saves.
2. **A file already sits at the output path of `pnpm package`**, for example a second run for the same version. Expected: a fresh zip. Without the delete, `zip` exits with code 3 ("Zip file structure invalid") when the old file is not a zip, and adds into it when it is. Test: Task 4, "the package script replaces an existing file at the output path".
3. **A relative output path, given from another folder.** Expected: the zip lands relative to the caller's folder, not inside `dist/`, where `zip` runs. Test: Task 4, "a relative output path is resolved from the caller's folder".
4. **An output folder that does not exist yet.** Expected: it is created. Test: Task 4, "the package script writes a zip with manifest.json at the top level" writes to a nested, missing folder.
5. **A version Chrome rejects**, such as `0.2.0-beta.1` from `pnpm version prerelease`. Chrome needs one to four dot-separated integers. Expected: `pnpm test` fails before such a version is packaged. Test: Task 1, "dist/manifest.json carries the package.json version" also matches the version against `/^\d+(\.\d+){0,3}$/`.

---

## Context

The scaffold (shipped in 2fbbcf5) works, but four gaps stop it from serving as a template. The spec (approved 2026-10-04) fixes items 1, 2, 3 and 5 of seven. Items 4 and 6 are out of scope.

The plan's facts were checked on 2026-10-04 in a scratch folder: the icon command (below) makes 8-bit PNGs with the size in bytes 16 to 23; `zip -r -X <out> .` run inside a folder puts `manifest.json` at the top of the list from `unzip -Z1`, with folder entries such as `icons/` listed too; `zip` exits with code 3 on an existing non-zip file.

Readings of the spec, recorded here and not asked:

- **Exit code when `tsc` is stopped by a signal.** The child's `code` is then `null`. If the script is stopping because it got `SIGINT` or `SIGTERM`, it exits with 0. Otherwise it exits with the child's code, or 1 when that code is `null`.
- **`fs.watch` gives a `null` file name** on some systems. Then the script schedules a copy anyway. A copy too many is harmless; a missed one is not.
- **A relative output path** for `package.mjs` is resolved against `process.cwd()` before `zip` runs inside `dist/` (Review Focus 3).
- **The scheduled copy prints nothing on success.** Only errors are printed. `tsc` already prints to the same terminal.
- **The red step for test 3 needs a second break** (spec, Testing): Task 2, Step 7 points the `"16"` key at the 32-pixel file and expects a failure.

## Files to Modify/Create

| File | Task | Responsibility |
|---|---|---|
| `scripts/copy-static.mjs` | 1, 2 | Exports `copyStatic()`; writes the version (1); copies `.png` (2) |
| `manifest.json` | 1, 2, 3 | No `version` (1); `icons`, `action.default_icon` (2); narrow match (3) |
| `test/build.test.ts` | 1 to 4 | Tests 1 to 5 of the spec, plus Review Focus 2 to 5 |
| `src/icons/icon-{16,32,48,128}.png` | 2 | Placeholder icons, committed |
| `scripts/package.mjs` | 4 | Zips `dist/` |
| `package.json` | 4, 5 | `package` script (4); `watch` script (5) |
| `.gitignore` | 4 | Adds `release/` |
| `scripts/watch.mjs` | 5 | `tsc --watch` plus re-running `copyStatic()` |

## Step-by-Step Implementation

Run every command from the worktree root, `.claude/worktrees/template-gaps`. The code stage creates it with `git worktree add .claude/worktrees/template-gaps -b feat/template-gaps` from the main checkout, then runs `pnpm install --frozen-lockfile` in it, because `node_modules/` is git-ignored and a new worktree has none. Every `pnpm` and `node` command below needs the `eval "$(fnm env)" &&` prefix from Global Constraints; it is left out below for reading.

Before every commit, read `git diff --cached`.

### Task 1: One version source

**Files:**

- Modify: `scripts/copy-static.mjs`, `manifest.json`
- Test: `test/build.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `export function copyStatic(): void` in `scripts/copy-static.mjs`. Throws on any error. Task 5 imports it.
  - In `test/build.test.ts`: `const root` (absolute path of the repo root, `new URL("../../", import.meta.url)`), `interface Manifest` gains `version?: string`. Tasks 2 to 4 add to this file.

- [ ] **Step 1: Write the failing tests in `test/build.test.ts`**

```ts
const root = fileURLToPath(new URL("../../", import.meta.url));

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as Record<string, unknown>;
}

test("dist/manifest.json carries the package.json version", () => {
  const version = readJson("package.json").version;
  assert.equal(typeof version, "string");
  assert.match(version as string, /^\d+(\.\d+){0,3}$/, "Chrome needs 1 to 4 dot-separated integers");
  assert.equal(readManifest().version, version);
});

test("the source manifest has no version", () => {
  assert.equal("version" in readJson("manifest.json"), false, "the version lives in package.json");
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test`
Expected: FAIL in "the source manifest has no version" only. The version test passes today, because both files say `0.1.0`.

- [ ] **Step 3: Remove `"version": "0.1.0",` from `manifest.json`, then run `pnpm test`**

Expected: FAIL in "dist/manifest.json carries the package.json version" with `undefined` against `'0.1.0'`. This is its red step.

- [ ] **Step 4: Rewrite `scripts/copy-static.mjs` around `export function copyStatic(): void`**

- Move the existing copy loop into `copyStatic()`. Keep `copy(from, to)`.
- Replace the manifest copy: read `manifest.json` and `package.json` with `JSON.parse`, then write `` `${JSON.stringify({ ...manifest, version: pkg.version }, null, 2)}\n` `` to `dist/manifest.json` (create `dist/` first).
- At the bottom: `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) copyStatic();` The end-of-branch fix round changed this to `pathToFileURL(realpathSync(process.argv[1]))`, so a symlinked path to the script also runs the copy.
- Update the header comment: it now also writes the version.

- [ ] **Step 5: Run the tests**

Run: `pnpm test`
Expected: PASS, all tests (19 old + 2 new).

- [ ] **Step 6: Commit**

```bash
git add scripts/copy-static.mjs manifest.json test/build.test.ts
git commit -m "feat(build): take the manifest version from package.json"
```

### Task 2: Icons

**Files:**

- Create: `src/icons/icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`
- Modify: `scripts/copy-static.mjs`, `manifest.json`
- Test: `test/build.test.ts`

**Interfaces:**

- Consumes: `copyStatic()` (Task 1).
- Produces: `dist/icons/*.png`. `interface Manifest` gains `icons?: Record<string, string>` and `action.default_icon?: Record<string, string>`.

- [ ] **Step 1: Write the failing test**

```ts
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("every icon exists and has the size of its key", () => {
  const manifest = readManifest();
  const icons = [
    ...Object.entries(manifest.icons ?? {}),
    ...Object.entries(manifest.action?.default_icon ?? {}),
  ];
  assert.ok(icons.length > 0, "the manifest names no icons");
  for (const [size, file] of icons) {
    const full = join(dist, file);
    assert.ok(existsSync(full), `dist/${file} is missing`);
    const bytes = readFileSync(full);
    assert.ok(bytes.subarray(0, 8).equals(PNG_SIGNATURE), `${file} is not a PNG`);
    assert.equal(bytes.readUInt32BE(16), Number(size), `${file} width`);
    assert.equal(bytes.readUInt32BE(20), Number(size), `${file} height`);
  }
});
```

- [ ] **Step 2: Run it**

Run: `pnpm test`
Expected: FAIL with "the manifest names no icons".

- [ ] **Step 3: Make the icons**

```bash
mkdir -p src/icons
for s in 16 32 48 128; do
  convert -size ${s}x${s} xc:'#3b6ea5' -fill white -gravity center \
    -font DejaVu-Sans-Bold -pointsize $((s*3/4)) -annotate +0+0 P \
    -depth 8 -strip src/icons/icon-$s.png
done
identify src/icons/*.png
```

Expected: four lines, `16x16`, `32x32`, `48x48`, `128x128`, each `8-bit`.

- [ ] **Step 4: Add `icons` and `action.default_icon` to `manifest.json`** exactly as in the spec's "Manifest" block. Keep `"matches": ["https://*/*"]` for now; Task 3 changes it.

- [ ] **Step 5: Run the tests**

Run: `pnpm test`
Expected: FAIL with "dist/icons/icon-16.png is missing", because the copy step skips `.png`.

- [ ] **Step 6: Copy `.png` in `copyStatic()`**

Change the extension filter to `/\.(html|css|png)$/` and the header comment to match.

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 7: Prove a wrong size fails**

Set `icons."16"` in `manifest.json` to `"icons/icon-32.png"`. Run `pnpm test`.
Expected: FAIL with "icons/icon-32.png width", 32 against 16. Undo the edit and run `pnpm test` again: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/icons scripts/copy-static.mjs manifest.json test/build.test.ts
git commit -m "feat(manifest): add placeholder icons"
```

### Task 3: Content script on one site

**Files:**

- Modify: `manifest.json`
- Test: `test/build.test.ts`

**Interfaces:**

- Consumes: `readManifest()`.
- Produces: `interface Manifest` `content_scripts` items gain `matches?: string[]`.

- [ ] **Step 1: Write the failing test**

```ts
test("no content script runs on every site", () => {
  const patterns = (readManifest().content_scripts ?? []).flatMap((script) => script.matches ?? []);
  assert.ok(patterns.length > 0, "no content script has a match pattern");
  for (const pattern of patterns) {
    assert.notEqual(pattern, "<all_urls>", "<all_urls> matches every site");
    const host = pattern.split("://")[1]?.split("/")[0];
    assert.notEqual(host, "*", `${pattern} matches every host`);
  }
});
```

- [ ] **Step 2: Run it**

Run: `pnpm test`
Expected: FAIL with "https://*/* matches every host".

- [ ] **Step 3: Set `"matches": ["https://example.com/*"]` in `manifest.json`**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add manifest.json test/build.test.ts
git commit -m "feat(content): run the content script on example.com only"
```

### Task 4: Package script

**Files:**

- Create: `scripts/package.mjs`
- Modify: `package.json` (the `package` script), `.gitignore`
- Test: `test/build.test.ts`

**Interfaces:**

- Consumes: a built `dist/`; `name` and `version` from `package.json`.
- Produces: `node scripts/package.mjs [output path]`. Exit code 0 and the absolute output path printed on success; exit code 1 and one of the two messages from Global Constraints on failure.

- [ ] **Step 1: Write the failing tests**

Add `spawnSync` from `node:child_process`, `mkdtempSync`, `mkdirSync`, `rmSync`, `writeFileSync` from `node:fs`, and `tmpdir` from `node:os`.

```ts
const packageScript = fileURLToPath(new URL("../../scripts/package.mjs", import.meta.url));
const hasZipTools = ["zip", "unzip"].every((tool) => spawnSync(tool, ["-v"]).error === undefined);
const skipZip = hasZipTools ? false : "zip or unzip is not installed";

function runPackage(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [packageScript, ...args], { cwd, encoding: "utf8" });
}

function zipEntries(path: string): string[] {
  return spawnSync("unzip", ["-Z1", path], { encoding: "utf8" }).stdout.trim().split("\n");
}

function withTempDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "play-ext-package-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the package script writes a zip with manifest.json at the top level", { skip: skipZip }, () => {
  withTempDir((dir) => {
    const out = join(dir, "missing-folder", "out.zip");
    const result = runPackage(root, out);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /out\.zip/);
    const entries = zipEntries(out);
    assert.ok(entries.includes("manifest.json"), entries.join(", "));
    assert.ok(entries.includes("content.js"), entries.join(", "));
  });
});

test("the package script replaces an existing file at the output path", { skip: skipZip }, () => {
  withTempDir((dir) => {
    const out = join(dir, "out.zip");
    writeFileSync(out, "not a zip");
    const result = runPackage(root, out);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(zipEntries(out).includes("manifest.json"));
  });
});

test("a relative output path is resolved from the caller's folder", { skip: skipZip }, () => {
  withTempDir((dir) => {
    const result = runPackage(dir, "relative.zip");
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(join(dir, "relative.zip")), "the zip is not in the caller's folder");
  });
});
```

- [ ] **Step 2: Run them**

Run: `pnpm test`
Expected: FAIL in all three with a non-zero status and "Cannot find module" in `stderr`.

- [ ] **Step 3: Write `scripts/package.mjs`**

Follow the spec's six steps under "scripts/package.mjs", with these choices:

- Paths from `new URL("..", import.meta.url)`, as `copy-static.mjs` does.
- Check `dist/manifest.json` first; print the "not built" message to `stderr` and exit 1.
- Output: ``resolve(process.argv[2] ?? join(root, "release", `${name}-${version}.zip`))``. `resolve` uses `process.cwd()`. Then `mkdirSync(dirname(out), { recursive: true })` and `rmSync(out, { force: true })`.
- `spawnSync("zip", ["-r", "-X", out, "."], { cwd: dist, stdio: "inherit" })`. On `result.error?.code === "ENOENT"`, print the "not installed" message and exit 1. On any other error or a non-zero `status`, exit 1.
- On success, `console.log(out)`.

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 4: Prove the delete and the resolve are needed**

Comment out the `rmSync` line. Run `pnpm test`. Expected: FAIL in "replaces an existing file", status 3. Restore it.

Replace `resolve(...)` with the bare argument. Run `pnpm test`. Expected: FAIL with "the zip is not in the caller's folder". Restore it, delete the stray `dist/relative.zip`, and run `pnpm test`: PASS.

- [ ] **Step 5: Add the script line and the ignore entry**

Add `"package": "pnpm clean && pnpm test && node scripts/package.mjs"` to `package.json` after `"build"`. Add `release/` to `.gitignore`.

- [ ] **Step 6: Run `pnpm package`**

Expected: tests pass, then the last line is the absolute path of `release/play-ext-0.1.0.zip`. `unzip -Z1 release/play-ext-0.1.0.zip | head -3` shows `manifest.json` with no folder in front. `git status --porcelain` does not list `release/`.

- [ ] **Step 7: Check the two failure messages**

```bash
rm -rf dist && node scripts/package.mjs; echo "exit $?"
```

Expected: `dist/ is not built. Run pnpm build first.` and `exit 1`.

```bash
pnpm build && PATH=/nonexistent "$(command -v node)" scripts/package.mjs; echo "exit $?"
```

Expected: `The zip command is not installed. Install it, or zip the contents of dist/ by hand.` and `exit 1`.

- [ ] **Step 8: Commit**

```bash
git add scripts/package.mjs package.json .gitignore test/build.test.ts
git commit -m "feat(build): add pnpm package to zip dist/"
```

### Task 5: Watch script

The spec checks `watch.mjs` by hand, not with a committed test. Steps 2 and 3 are a scripted check the code stage runs; the full manual check runs at the end of the branch.

**Files:**

- Create: `scripts/watch.mjs`
- Modify: `package.json` (the `watch` script)

**Interfaces:**

- Consumes: `copyStatic()` from `./copy-static.mjs` (Task 1).
- Produces: `pnpm watch`.

- [ ] **Step 1: Write `scripts/watch.mjs` and set `"watch": "node scripts/watch.mjs"`**

Follow the spec's six steps under "scripts/watch.mjs", with these choices:

- One debounce timer: each scheduled change runs `clearTimeout`, then `setTimeout(copy, 100)`. The copy catches errors and prints them with `console.error`.
- `src/` watcher: `fs.watch(src, { recursive: true }, …)`; schedule a copy when the file name ends in `.html`, `.css` or `.png`, or is `null`.
- Root watcher: `fs.watch(root, …)` with no options; schedule a copy when the file name is `manifest.json` or `package.json`, or is `null`.
- `spawn("tsc", ["-p", "tsconfig.json", "--watch"], { cwd: root, stdio: "inherit" })`. On the child's `error` event with `code === "ENOENT"`, print `Run this through pnpm watch` and exit 1.
- On `SIGINT` and `SIGTERM`: set a `stopping` flag and call `child.kill()`. On the child's `exit`: `process.exit(stopping ? 0 : (code ?? 1))`.

Run: `pnpm test`
Expected: PASS (Biome checks the new file; no test runs it).

- [ ] **Step 2: Scripted check of the start, a CSS edit and the stop**

```bash
rm -rf dist
PATH="$PWD/node_modules/.bin:$PATH" timeout --preserve-status -s INT 12 node scripts/watch.mjs > /tmp/watch.log 2>&1 &
pid=$!
sleep 6
test -f dist/manifest.json && test -f dist/icons/icon-16.png && test -f dist/background.js && echo "start ok"
echo "/* watch check */" >> src/popup/popup.css
sleep 1
tail -1 dist/popup/popup.css
git checkout src/popup/popup.css
wait "$pid"; echo "exit $?"
```

Expected: `start ok`, then `/* watch check */`, then `exit 0` (`--preserve-status` passes the script's own exit code through). After it ends, `pgrep -af "tsc -p tsconfig.json --watch"` lists no process started from this worktree.

- [ ] **Step 3: Scripted check of a rename-save of `manifest.json` and a broken manifest**

```bash
PATH="$PWD/node_modules/.bin:$PATH" timeout --preserve-status -s INT 12 node scripts/watch.mjs > /tmp/watch.log 2>&1 &
pid=$!
sleep 4
cp manifest.json /tmp/m.json
sed 's/Play Ext/Play Ext A/' /tmp/m.json > manifest.tmp && command mv -f manifest.tmp manifest.json; sleep 1
grep -c '"Play Ext A"' dist/manifest.json
sed 's/Play Ext/Play Ext B/' /tmp/m.json > manifest.tmp && command mv -f manifest.tmp manifest.json; sleep 1
grep -c '"Play Ext B"' dist/manifest.json
echo '{' > manifest.tmp && command mv -f manifest.tmp manifest.json; sleep 1
command cp -f /tmp/m.json manifest.json; sleep 1
grep -c '"Play Ext"' dist/manifest.json
wait "$pid"; grep -ci json /tmp/watch.log
git status --porcelain manifest.json
```

Expected: `1`, `1`, `1` (both rename-saves reached `dist/`, and the copy ran again after the fix), a non-zero count of JSON parse errors in the log, and no change to `manifest.json`.

- [ ] **Step 4: Check the message without pnpm**

Run: `PATH=/nonexistent "$(command -v node)" scripts/watch.mjs; echo "exit $?"`
Expected: `Run this through pnpm watch` and `exit 1`.

- [ ] **Step 5: Commit**

```bash
git add scripts/watch.mjs package.json
git commit -m "feat(build): make pnpm watch copy static files"
```

## Trade-Offs / Alternatives Considered

The spec settles the main choices (T1 to T6). This plan adds these smaller ones:

- **Red step for the version test.** Write both tests first, then remove the source `version` before the copy step writes it. That gives each test its own red failure without a separate break.
- **Icon colour depth.** ImageMagick 6 writes 16-bit PNGs by default. `-depth 8` gives files a quarter the size. Chrome accepts both. **Chosen:** `-depth 8`.
- **Three package tests vs one.** One test could cover the top-level layout, the existing file and the relative path. Separate tests name the failing case directly. **Chosen:** three, sharing `runPackage`, `zipEntries` and `withTempDir`.
- **A committed test for `watch.mjs` vs scripted checks.** The spec decides against a committed test (flaky long-running process). The scripted checks in Task 5 run once in the code stage and are not part of `pnpm test`.

## Dependencies

- No new npm packages. `@biomejs/biome`, `@types/chrome`, `@types/node`, `typescript` stay as they are.
- Node 22.17.0 through `fnm`. Recursive `fs.watch` on Linux needs Node 20 or later.
- System tools: `zip` and `unzip` (`/usr/bin`) for `pnpm package` and the Task 4 tests; ImageMagick 6.9 `convert` with the `DejaVu-Sans-Bold` font, once, in Task 2.
- A Chromium browser for the manual check at the end of the branch.

## Risk

- **This narrows the content script's host access** (the reason the change is Large). The page counter now counts only `https://example.com` visits. No published extension or stored data is affected. Reverse by changing one line in `manifest.json`. Blast radius: `manifest.json`; `src/content.ts` and `src/lib/handler.ts` do not change.
- **`fs.watch` can miss or repeat events.** Repeats are harmless: the copy is idempotent and debounced. A missed event leaves a stale file until `pnpm build`. Known limit.
- **Watch never removes deleted files from `dist/`.** `pnpm clean` fixes it, and `pnpm package` cleans first. Known limit.
- **The Task 4 tests are skipped without `zip` or `unzip`.** `pnpm test` still passes, and the skip reason shows in the output.
- **`pnpm package` fails on plain Windows.** Known limit under T3; the message says what to do.
- **The source manifest is no longer complete.** Copying it by hand gives "Required value 'version' is missing" in Chrome. Test 2 pins the choice.
- **A scoped package name such as `@me/ext`** would put a `/` in the default zip name, so the zip lands in a subfolder of `release/`. Today's name is `play-ext`. Known limit.
- **Task 4, Step 4 leaves `dist/relative.zip` while the resolve is broken.** The step deletes it. If it stays, it does not reach a release, because `pnpm package` cleans first.
- **Scripted checks use `/tmp/watch.log` and `/tmp/m.json`.** Another session running the same check at the same time would collide. The checks are short.
- **`pnpm version prerelease`** gives a version Chrome rejects. Detection: the Task 1 version test fails in `pnpm test`, so `pnpm package` stops before zipping. The test catches a prerelease suffix only. It does not catch a part above 65535 or a part with a leading zero, such as `1.01.0`, which Chrome also rejects. `pnpm version` never writes those. Known limit (end-of-branch code review).
- **A `package.json` with no `version`** gives a `dist/manifest.json` with no version, and `pnpm build` and `pnpm watch` still succeed. Chrome rejects the manifest. The Task 1 test catches it in `pnpm test`, so `pnpm package` stops. Today's `package.json` has a version. Known limit (end-of-branch code review).
- **The "no content script runs on every site" test checks only `<all_urls>` and a `*` host.** A `file:///*` pattern would pass it. Chrome also needs the user to switch on "Allow access to file URLs" for such a script. Today's match is `https://example.com/*`. Known limit (end-of-branch code review).
- **On Node 22.0 to 22.14, `pnpm watch` stopped by SIGTERM leaves the TypeScript 7 compiler running.** `child.kill()` stops only the `tsc` launcher there. Ctrl+C in a terminal is not affected, and this machine runs Node 22.17. Raising `engines` to `>=22.15` would remove it, but the plan keeps `>=22`. Known limit (end-of-branch soundness review).
- **The `error` handler on the `fs.watch` watchers is not exercised.** Removing `src/` under a running watch fires no error on Linux. The handler kills `tsc` and exits with code 1 when a watch error does fire. Known limit (end-of-branch code review fix round).
- **`pnpm package <relative path>` resolves the path from the package root, not the caller's folder.** pnpm runs scripts from the package root; the caller's folder is only in `INIT_CWD`. The test spawns `node` directly, so it covers `node scripts/package.mjs`, not the `pnpm package` route. Known limit (end-of-branch code re-review).
- **The main-module check in `copy-static.mjs` fails silently when the two URLs differ**, for example under `node --preserve-symlinks-main` or on Windows. `pnpm build` then exits 0 without copying. A module with no side effects plus a separate entry script would remove it. Known limit (end-of-branch code re-review).
- **Ctrl+C can make `pnpm watch` exit with code 1.** SIGINT reaches `tsc` and the script together; if `tsc`'s exit is handled first, `stopping` is still false, and pnpm prints "Command failed". The scripted checks, which signal only the script, exit 0. Known limit (end-of-branch code re-review).
- **A `tsc` that ignores SIGTERM keeps `pnpm watch` running.** Each Ctrl+C only calls `child.kill()` again; there is no forced exit on a second signal. Known limit (end-of-branch code re-review).
- **`pnpm watch` fails on plain Windows.** `spawn("tsc")` without a shell cannot start the `tsc.cmd` shim, so it prints "Run this through pnpm watch". Same limit as `pnpm package` under T3. Known limit (end-of-branch code re-review).
- **The symlink test deletes the real `dist/manifest.json` while it runs.** It restores the file in a `finally`. If the test run is killed in between, the next run without a rebuild fails the manifest tests; `pnpm test` rebuilds first, so this only affects a bare `node --test`. Known limit (end-of-branch code re-review).

## Testing Strategy

- **Unit and build tests** (`pnpm test`): the 19 existing tests, plus 8 new ones in `test/build.test.ts` (7 from the tasks, 1 from the end-of-branch fix round: the copy step runs through a symlinked path). Task 1: version carried and valid, no source version. Task 2: icon files and sizes. Task 3: no all-sites pattern. Task 4: three package tests, which spawn the real script and read the real zip (the end-to-end test of the new public surface, `pnpm package`).
- **Red steps:** every new test fails first with the message its step names. Three checks need a deliberate break, because their first implementation passes them: the icon size (Task 2, Step 7), the delete (Task 4, Step 4) and the resolve (Task 4, Step 4).
- **Scripted checks in the code stage:** Task 4, Steps 6 and 7 (`pnpm package` and its two messages); Task 5, Steps 2 to 4 (watch start, CSS edit, rename-saves, broken manifest, stop, missing `tsc`).
- **End-of-branch check (manual, by the user):** the spec's seven-step watch check in Chrome, then `pnpm package`, unzip the zip, and "Load unpacked" it. The code stage cannot drive Chrome, so the review stage asks the user to run this.

## Open Questions

None. The readings of the spec are listed under Context.
