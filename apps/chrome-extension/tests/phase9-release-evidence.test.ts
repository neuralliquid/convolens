import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const hasAuthoredPreload = (source: string) => {
  const attributes =
    /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\}|\{\s*`([^`]*)`\s*\}|([^\s>]+))/gi;
  for (const match of source.matchAll(attributes)) {
    const value = match.slice(1).find((candidate) => candidate !== undefined);
    if (
      value?.split(/\s+/).some((token) => token.toLowerCase() === "preload")
    ) {
      return true;
    }
  }
  return false;
};

test("keeps release versions aligned and package inspection mandatory", () => {
  const manifest = JSON.parse(read("../manifest.json"));
  const packageJson = JSON.parse(read("../package.json"));
  assert.equal(manifest.version, "1.0.20");
  assert.equal(packageJson.version, manifest.version);
  assert.match(
    packageJson.scripts.package,
    /package-extension\.mjs && node scripts\/verify-package\.mjs$/,
  );
});

test("runs extension, intake, and inspected-package evidence in CI", () => {
  const workflow = read("../../../.github/workflows/ci.yml");
  assert.match(workflow, /@convolens\/chrome-extension test/);
  assert.match(
    workflow,
    /jest --config=jest\.config\.js --runInBand src\/services\/__tests__\/conversation-intake\.service\.test\.ts/,
  );
  assert.match(workflow, /@convolens\/chrome-extension package/);
});

test("records the authored web preload inventory deterministically", () => {
  for (const source of [
    '<link rel="preload">',
    '<link rel = "preload">',
    '<link rel={"preload"}>',
    "<link rel = {'preload'}>",
    "<link rel={`preload`} />",
    "<link rel=preload>",
    '<link rel="stylesheet preload">',
  ]) {
    assert.equal(hasAuthoredPreload(source), true);
  }
  assert.equal(hasAuthoredPreload('<link rel="preloader">'), false);
  const webRoot = new URL("../../web/src/", import.meta.url);
  const files = readdirSync(webRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => /\.(?:tsx?|jsx?|html)$/.test(entry.name));
  const authoredPreloads = files.filter((entry) => {
    const source = readFileSync(resolve(entry.parentPath, entry.name), "utf8");
    return hasAuthoredPreload(source);
  });
  assert.deepEqual(authoredPreloads, []);
});
