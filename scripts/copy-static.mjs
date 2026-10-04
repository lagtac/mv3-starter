// Writes dist/manifest.json with the version from package.json, and copies every
// .html, .css and .png file under src/ into dist/.
// tsc compiles only the .ts files, so the build runs this after it.
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const dist = join(root, "dist");

function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

// The static files besides manifest.json. watch.mjs uses it to pick the changes to copy.
export const STATIC_FILE = /\.(html|css|png)$/;

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

export function copyStatic() {
  const manifest = readJson("manifest.json");
  const pkg = readJson("package.json");
  mkdirSync(dist, { recursive: true });
  writeFileSync(
    join(dist, "manifest.json"),
    `${JSON.stringify({ ...manifest, version: pkg.version }, null, 2)}\n`,
  );

  for (const entry of readdirSync(src, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !STATIC_FILE.test(entry.name)) continue;
    const from = join(entry.parentPath, entry.name);
    copy(from, join(dist, relative(src, from)));
  }
}

// import.meta.url has symlinks resolved, so argv[1] must be too, or a symlinked path copies nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  copyStatic();
}
