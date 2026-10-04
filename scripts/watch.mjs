// Runs tsc --watch, copies the static files again when one of them changes, and deletes the
// dist/ copy of a file deleted from src/.
// tsc watches only the .ts files, so without this a CSS or manifest edit never reaches dist/.
import { spawn } from "node:child_process";
import { rmSync, watch } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyStatic, removeStale } from "./copy-static.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");

// Start from an empty dist/, so a file deleted or renamed in src/ leaves no old copy behind.
try {
  rmSync(join(root, "dist"), { recursive: true, force: true });
  copyStatic();
} catch (error) {
  console.error(error);
  process.exit(1);
}

// One save often fires several events, so the copy waits until they stop.
// The wait also lets an editor that saves by rename put the file back before removeStale looks.
let timer;
const changed = new Set();
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(copy, 100);
}

function copy() {
  // A name that cannot be removed is dropped, so it does not block every later copy.
  const names = [...changed];
  changed.clear();
  for (const name of names) {
    try {
      removeStale(name);
    } catch (error) {
      console.error(error);
    }
  }
  try {
    copyStatic();
  } catch (error) {
    console.error(error);
  }
}

// The watches start before tsc, so a watch that cannot start leaves no tsc running.
// Some systems give no file name; a copy too many is harmless, a missed one is not.
// Without a name, nothing is removed, and a deleted file's copy stays until a restart.
const watchers = [
  watch(src, { recursive: true }, (_event, name) => {
    if (name !== null) changed.add(name);
    schedule();
  }),
  // The root folder, not the two files: editors that save by rename leave a file watch behind.
  watch(root, (_event, name) => {
    if (name === null || name === "manifest.json" || name === "package.json") schedule();
  }),
];

let stopping = false;
const child = spawn("tsc", ["-p", "tsconfig.json", "--watch"], { cwd: root, stdio: "inherit" });
child.on("error", (error) => {
  if (error.code === "ENOENT") console.error("Run this through pnpm watch");
  else console.error(error);
  process.exit(1);
});
child.on("exit", (code) => process.exit(stopping ? 0 : (code ?? 1)));

function stop() {
  stopping = true;
  child.kill();
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);

// A watch that fails later, for example when src/ is removed, stops tsc too instead of leaving it
// alone. stopping stays false, so the exit handler exits with code 1.
for (const watcher of watchers) {
  watcher.on("error", (error) => {
    console.error(error);
    child.kill();
  });
}
