// Copies manifest.json and every .html and .css file under src/ into dist/.
// tsc compiles only the .ts files, so the build runs this after it.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const dist = join(root, "dist");

function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

copy(join(root, "manifest.json"), join(dist, "manifest.json"));

for (const entry of readdirSync(src, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !/\.(html|css)$/.test(entry.name)) continue;
  const from = join(entry.parentPath, entry.name);
  copy(from, join(dist, relative(src, from)));
}
