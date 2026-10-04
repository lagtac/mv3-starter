# play-ext

A Manifest V3 browser extension, used as a learning playground.

## Git workflow

- Plans index: none.
- Commit scopes: `manifest`, `background`, `content`, `popup`, `options`, `lib`, `build`, `test`, `docs`.
- Test command for each code commit: `pnpm test`. It runs the Biome check, then builds `dist/`. `pnpm fix` applies Biome's safe fixes.
- Remote: `origin` on GitHub, `git@github.com:lagtac/play-ext.git`. Pushing is manual.
