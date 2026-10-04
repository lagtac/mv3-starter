// Zips the contents of dist/ for the Chrome Web Store, with manifest.json at the top.
// Usage: node scripts/package.mjs [output path]. The default is release/<name>-<version>.zip.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");

function fail(message) {
  if (message) console.error(message);
  process.exit(1);
}

if (!existsSync(join(dist, "manifest.json"))) fail("dist/ is not built. Run pnpm build first.");

const { name, version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
// zip runs inside dist/, so a relative path is resolved from the caller's folder first.
const out = resolve(process.argv[2] ?? join(root, "release", `${name}-${version}.zip`));
mkdirSync(dirname(out), { recursive: true });
// Without this, zip adds into an old archive, or rejects a file that is not a zip.
rmSync(out, { force: true });

const result = spawnSync("zip", ["-r", "-X", out, "."], { cwd: dist, stdio: "inherit" });
if (result.error?.code === "ENOENT") {
  fail("The zip command is not installed. Install it, or zip the contents of dist/ by hand.");
}
if (result.error) fail(result.error.message);
if (result.status !== 0) fail();

console.log(out);
