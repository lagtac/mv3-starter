import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// This file runs from .test-build/test/, so the real build output is two levels up.
const dist = fileURLToPath(new URL("../../dist/", import.meta.url));
const root = fileURLToPath(new URL("../../", import.meta.url));

function readDist(path: string): string {
  const full = join(dist, path);
  assert.ok(existsSync(full), `dist/${path} is missing`);
  return readFileSync(full, "utf8");
}

interface Manifest {
  version?: string;
  background?: { service_worker?: string };
  icons?: Record<string, string>;
  action?: { default_popup?: string; default_icon?: Record<string, string> };
  options_page?: string;
  options_ui?: { page?: string };
  side_panel?: { default_path?: string };
  devtools_page?: string;
  chrome_url_overrides?: Record<string, string>;
  content_scripts?: { matches?: string[]; js?: string[] }[];
}

function readManifest(): Manifest {
  return JSON.parse(readDist("manifest.json")) as Manifest;
}

function manifestPages(manifest: Manifest): string[] {
  return [
    manifest.action?.default_popup,
    manifest.options_page,
    manifest.options_ui?.page,
    manifest.side_panel?.default_path,
    manifest.devtools_page,
    ...Object.values(manifest.chrome_url_overrides ?? {}),
  ].filter((page): page is string => page !== undefined);
}

test("every file named in the manifest exists in dist/", () => {
  const manifest = readManifest();
  const files = [
    manifest.background?.service_worker,
    ...manifestPages(manifest),
    ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? []),
  ].filter((file): file is string => file !== undefined);
  assert.ok(files.length > 0, "the manifest names no files");
  for (const file of files) assert.ok(existsSync(join(dist, file)), `dist/${file} is missing`);
});

test("no content script has module syntax", () => {
  const scripts = (readManifest().content_scripts ?? []).flatMap((script) => script.js ?? []);
  assert.ok(scripts.length > 0, "the manifest names no content script");
  for (const script of scripts) {
    const lines = readDist(script).split("\n");
    const moduleLines = lines.filter((line) => /^\s*(import|export)\b/.test(line));
    assert.deepEqual(moduleLines, [], `${script} runs as a classic script`);
  }
});

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".html"))
    .sort();
}

function pages(): string[] {
  return htmlFiles(dist);
}

// The build never cleans dist/, so a page renamed in src/ leaves the old copy behind.
test("dist/ holds exactly the pages in src/", () => {
  assert.deepEqual(pages(), htmlFiles(join(root, "src")));
});

// A page the code opens with chrome.tabs.create is allowed too, so this is not an exact match.
test("the page tests check every page the manifest names", () => {
  const names = manifestPages(readManifest());
  const found = pages();
  for (const name of names) assert.ok(found.includes(name), `${name} is not among ${found}`);
});

test("every script and stylesheet a page loads exists", () => {
  for (const page of pages()) {
    const html = readDist(page);
    const refs = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.ok(refs.length > 0, `${page} loads no files`);
    for (const ref of refs) {
      // A page's paths are relative to its own folder: options.html links ../popup/popup.css.
      const target = join(dirname(page), ref);
      assert.ok(existsSync(join(dist, target)), `${page} points to missing dist/${target}`);
    }
  }
});

test("every page script is an ES module", () => {
  for (const page of pages()) {
    const scripts = readDist(page).match(/<script\b[^>]*>/g) ?? [];
    assert.ok(scripts.length > 0, `${page} has no script`);
    for (const tag of scripts) assert.match(tag, /\btype="module"/, `${page}: ${tag}`);
  }
});

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as Record<string, unknown>;
}

test("dist/manifest.json carries the package.json version", () => {
  const version = readJson("package.json").version;
  assert.equal(typeof version, "string");
  assert.match(
    version as string,
    /^\d+(\.\d+){0,3}$/,
    "Chrome needs 1 to 4 dot-separated integers",
  );
  assert.equal(readManifest().version, version);
});

test("the copy step runs when started through a symlinked path", () => {
  const manifest = join(dist, "manifest.json");
  const saved = readFileSync(manifest);
  withTempDir((dir) => {
    const link = join(dir, "repo");
    symlinkSync(root, link);
    rmSync(manifest);
    try {
      const result = spawnSync(process.execPath, [join(link, "scripts", "copy-static.mjs")], {
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(existsSync(manifest), "dist/manifest.json was not written");
    } finally {
      if (!existsSync(manifest)) writeFileSync(manifest, saved);
    }
  });
});

test("the build deletes a file that is no longer in src/", () => {
  const stale = join(dist, "stale.js");
  writeFileSync(stale, "");
  const result = spawnSync("pnpm", ["build"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(stale), false, "dist/stale.js is still there");
});

test("the source manifest has no version", () => {
  assert.equal("version" in readJson("manifest.json"), false, "the version lives in package.json");
});

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

test("no content script runs on every site", () => {
  const patterns = (readManifest().content_scripts ?? []).flatMap((script) => script.matches ?? []);
  assert.ok(patterns.length > 0, "no content script has a match pattern");
  for (const pattern of patterns) {
    assert.notEqual(pattern, "<all_urls>", "<all_urls> matches every site");
    const host = pattern.split("://")[1]?.split("/")[0];
    assert.notEqual(host, "*", `${pattern} matches every host`);
  }
});

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

test("the package script writes a zip with manifest.json at the top level", {
  skip: skipZip,
}, () => {
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
