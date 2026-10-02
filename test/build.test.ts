import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// This file runs from .test-build/test/, so the real build output is two levels up.
const dist = fileURLToPath(new URL("../../dist/", import.meta.url));

function readDist(path: string): string {
  const full = join(dist, path);
  assert.ok(existsSync(full), `dist/${path} is missing`);
  return readFileSync(full, "utf8");
}

interface Manifest {
  background?: { service_worker?: string };
  action?: { default_popup?: string };
  options_page?: string;
  content_scripts?: { js?: string[] }[];
}

function readManifest(): Manifest {
  return JSON.parse(readDist("manifest.json")) as Manifest;
}

test("every file named in the manifest exists in dist/", () => {
  const manifest = readManifest();
  const files = [
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    manifest.options_page,
    ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? []),
  ].filter((file): file is string => file !== undefined);
  assert.ok(files.length > 0, "the manifest names no files");
  for (const file of files) assert.ok(existsSync(join(dist, file)), `dist/${file} is missing`);
});

test("content.js has no module syntax", () => {
  const lines = readDist("content.js").split("\n");
  const moduleLines = lines.filter((line) => /^\s*(import|export)\b/.test(line));
  assert.deepEqual(moduleLines, [], "content.js runs as a classic script");
});

function pages(): string[] {
  return readdirSync(dist, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".html"))
    .sort();
}

test("the manifest declares the popup and the options page", () => {
  const manifest = readManifest();
  assert.equal(manifest.action?.default_popup, "popup/popup.html");
  assert.equal(manifest.options_page, "options/options.html");
});

test("dist/ holds exactly the two pages", () => {
  assert.deepEqual(pages(), ["options/options.html", "popup/popup.html"]);
});

test("every script and stylesheet a page loads exists", () => {
  for (const page of pages()) {
    const html = readDist(page);
    const refs = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
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
