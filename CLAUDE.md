# mv3-starter

A starter template for a Manifest V3 Chrome extension, written in TypeScript.

## Git workflow

- Plans index: none.
- Commit scopes: `manifest`, `background`, `content`, `popup`, `options`, `lib`, `build`, `test`, `docs`.
- Test command for each code commit: `pnpm test`. It runs the Biome check, then builds `dist/`. `pnpm fix` applies Biome's safe fixes.
- Remote: `origin` on GitHub, `git@github.com:lagtac/mv3-starter.git`. Pushing is manual.
