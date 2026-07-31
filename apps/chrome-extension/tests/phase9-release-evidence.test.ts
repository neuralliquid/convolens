import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { verifyLocalEntryIntegrity } from "../scripts/verify-package.mjs";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

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

test("requires local ZIP sizes and CRC when no data descriptor is present", () => {
  const entry = {
    name: "manifest.json",
    flags: 0,
    crc: 123,
    compressedSize: 456,
    uncompressedSize: 789,
  };
  assert.doesNotThrow(() =>
    verifyLocalEntryIntegrity(entry, {
      crc: 123,
      compressedSize: 456,
      uncompressedSize: 789,
    }),
  );
  for (const local of [
    { crc: 122, compressedSize: 456, uncompressedSize: 789 },
    { crc: 123, compressedSize: 455, uncompressedSize: 789 },
    { crc: 123, compressedSize: 456, uncompressedSize: 788 },
  ]) {
    assert.throws(
      () => verifyLocalEntryIntegrity(entry, local),
      /local entry sizes or CRC are inconsistent/,
    );
  }
  assert.doesNotThrow(() =>
    verifyLocalEntryIntegrity(
      { ...entry, flags: 0x08 },
      { crc: 0, compressedSize: 0, uncompressedSize: 0 },
    ),
  );
});
