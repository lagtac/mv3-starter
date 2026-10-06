# Changelog

Changes to the mv3-starter template, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

A project made from this template does not receive later changes by itself, because it shares no git history with this repo. Read the entries newer than the day the project was made, and copy the ones it needs by hand.

## [Unreleased]

### Changed

- Renamed the template from `play-ext` to `mv3-starter`. Its repo is now `git@github.com:lagtac/mv3-starter.git`, and the old URL no longer redirects. A project made from the template has its own name, so it has nothing to copy.

### 2026-10-06 — Starting point

The template as it stood when this changelog began. A project made on or after this day already has everything below.

- A Manifest V3 extension in TypeScript, with a content script, a background service worker, a popup and an options page. See [the MV3 scaffold spec](docs/plans/2026-10-02-mv3-scaffold-spec.md).
- pnpm as the package manager, and Biome as the linter and formatter.
- `pnpm watch`, `pnpm package`, icons, one version source in `package.json`, and a narrow content script match. See [the template gaps spec](docs/plans/2026-10-04-template-gaps-spec.md).
- `pnpm build` deletes `dist/` first, and `pnpm watch` deletes a file's copy in `dist/` when the file is deleted from `src/`.
- Biome is the VS Code formatter for the project, set in `.vscode/settings.json`.
