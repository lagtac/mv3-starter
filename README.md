# play-ext

A starter for a Manifest V3 Chrome extension, written in TypeScript.

The build uses only `tsc`, the TypeScript compiler, plus three short Node scripts in `scripts/`. There is no bundler. The extension targets Chrome. Firefox needs `background.scripts` in place of `background.service_worker`, so it does not load as is.

## What it does

The extension is a small working example of each part:

- The **content script** (`src/content.ts`) runs on `https://example.com/*`. It tells the background that a page was seen.
- The **background service worker** (`src/background.ts`) counts those pages in `chrome.storage.session`.
- The **popup** (`src/popup/`) shows the count and a greeting, and has a button that resets the count.
- The **options page** (`src/options/`) edits the greeting, which is saved in `chrome.storage.sync`.

The logic lives in `src/lib/`. It takes a `Store` interface in place of `chrome.storage`, so the tests run in Node with a fake store from `test/fakes.ts`.

## Requirements

- Node 22 or later.
- pnpm, at the version in the `packageManager` field of `package.json`.
- The `zip` command, for `pnpm package` only.

## Getting started

```sh
pnpm install
pnpm watch
```

Then load the extension:

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick the `dist/` folder.

`pnpm watch` rebuilds `dist/` when a file changes. Chrome does not pick up the change by itself: click the reload button on the extension's card, then reload any open `example.com` tab.

## Scripts

| Command | What it does |
|---|---|
| `pnpm watch` | Deletes and builds `dist/`, then rebuilds it on every change to `src/`, `manifest.json` or `package.json`. A file deleted or renamed in `src/` loses its copy in `dist/` too, on systems where the file watcher reports file names, such as Linux, macOS and Windows. Elsewhere, restart it after a delete or rename. |
| `pnpm build` | Deletes `dist/`, then builds it once. |
| `pnpm test` | Runs the Biome check, builds `dist/`, then runs the tests in `test/`. |
| `pnpm check` | Runs Biome, the linter and formatter, without changing files. |
| `pnpm fix` | Applies Biome's safe fixes. |
| `pnpm package` | Cleans, runs the tests, and writes `release/<name>-<version>.zip` for the Chrome Web Store. |
| `pnpm clean` | Deletes `dist/` and `.test-build/`. |

## Rules the build depends on

- **Imports end in `.js`.** Write `import { x } from "./lib/handler.js"`, even though the file is `handler.ts`. No bundler rewrites the paths, so the browser loads them exactly as written.
- **The content script has no `import` or `export`.** Chrome runs it as a classic script, and module syntax fails there. A type can still be used inline, as `src/content.ts` does with `import("./lib/messages.js").Message`. Shared runtime code cannot be imported into it. A test fails if a content script the manifest lists has module syntax.
- **Every HTML page loads its script with `type="module"`.** A test checks this.
- **The version lives only in `package.json`.** The build writes it into `dist/manifest.json`. A test fails if `manifest.json` in the project root has a `version` field.
- **Static files are copied by extension.** The build copies every `.html`, `.css` and `.png` file under `src/` to the same path in `dist/`. To copy another file type, add it to `STATIC_FILE` in `scripts/copy-static.mjs`.

## Adding a page

1. Add `src/<name>/<name>.html` and `src/<name>/<name>.ts`. Load the script with `<script type="module" src="<name>.js"></script>`.
2. If Chrome opens the page itself, name it in `manifest.json`, for example as `options_ui.page`. Some keys also need a permission: `side_panel.default_path` needs `"sidePanel"` in `permissions`.

The tests check every page in `dist/`. A page named in the manifest must exist there. `dist/` must hold no page that `src/` does not.

## Using this as a template

Change these before you build anything of your own:

| File | What to change |
|---|---|
| `package.json` | `name`, `version`. The name also names the zip. |
| `manifest.json` | `name`, `description`, and the `content_scripts` match pattern. |
| `src/popup/popup.html`, `src/options/options.html` | The `<title>`. |
| `src/icons/` | The four icons. Each must be a PNG whose width and height equal its key in `manifest.json`. |
| `CLAUDE.md`, `README.md` | The project name and description. |
| `docs/plans/` | The design history of this starter. Delete it. |
| `ROADMAP.md` | The roadmap of this starter. Delete it, or clear its rows and start your own. |

Then replace the example code: the counter in `src/lib/handler.ts` and `src/lib/messages.ts`, and the greeting in `src/lib/settings.ts`. Delete or rewrite their tests in `test/` with them.

A test fails if a content script matches every site, such as `<all_urls>` or `*://*/*`. Chrome's review is slower for such extensions. Change that test only if your extension needs it.
