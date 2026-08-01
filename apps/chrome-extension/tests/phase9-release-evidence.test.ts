import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  verifyDataDescriptor,
  verifyCentralDirectoryExtent,
  verifyEndOfCentralDirectory,
  verifyEntryRequirements,
  verifyExtraFields,
  verifyLocalEntryIntegrity,
  verifyNonOverlappingLocalRecords,
  verifyLocalRecordExtent,
  verifyRegularFileEntry,
  verifySingleDiskEntry,
} from "../scripts/verify-package.mjs";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("keeps release versions aligned and package inspection mandatory", () => {
  const manifest = JSON.parse(read("../manifest.json"));
  const packageJson = JSON.parse(read("../package.json"));
  assert.equal(manifest.version, "1.0.22");
  assert.equal(packageJson.version, manifest.version);
  assert.deepEqual(manifest.content_scripts[0], {
    matches: ["https://web.whatsapp.com/*"],
    js: ["dist/whatsapp-page-identity.js"],
    run_at: "document_start",
    world: "MAIN",
  });
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
    /jest --config=jest\.config\.js --runInBand[\s\S]*src\/services\/__tests__\/conversation-intake\.service\.test\.ts/,
  );
  assert.match(workflow, /test:browser:persistence/);
  assert.match(workflow, /@convolens\/chrome-extension package/);
  assert.match(workflow, /Upload current-main extension artifact/);
  assert.match(
    workflow,
    /github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/,
  );
  assert.match(workflow, /convolens-extension\.zip\.sha256/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.match(workflow, /publish-extension-release:/);
  assert.match(workflow, /name: Publish Extension Release/);
  assert.match(workflow, /needs: validate/);
  assert.match(workflow, /permissions:\s*\n\s*contents: write/);
  assert.match(workflow, /actions\/download-artifact@/);
  assert.match(workflow, /sha256sum --check convolens-extension\.zip\.sha256/);
  assert.match(workflow, /TAG="extension-v\$\{VERSION\}"/);
  assert.match(workflow, /gh release download "\$TAG"/);
  assert.match(workflow, /cmp -s/);
  assert.match(workflow, /gh release create "\$TAG"/);
  assert.match(workflow, /--target "\$GITHUB_SHA"/);
});

test("publishes only a validated extension ZIP and checksum to releases", () => {
  const workflow = read("../../../.github/workflows/release-validation.yml");
  assert.match(workflow, /@convolens\/chrome-extension package/);
  assert.match(workflow, /sha256sum convolens-extension\.zip/);
  assert.match(workflow, /name: Publish Extension Release Asset/);
  assert.match(
    workflow,
    /github\.event_name == 'release' && needs\.validate-application\.result == 'success'/,
  );
  assert.match(workflow, /permissions:\s*\n\s*contents: write/);
  assert.match(workflow, /actions\/download-artifact@/);
  assert.match(workflow, /GH_REPO: \$\{\{ github\.repository \}\}/);
  assert.match(workflow, /gh release upload "\$RELEASE_TAG"/);
  assert.match(workflow, /convolens-extension\.zip\.sha256/);
});

test("shares production WhatsApp readiness selectors with authentic fixtures", () => {
  const readiness = read("../e2e/whatsapp-readiness.ts");
  const provisioner = read("../e2e/provision-auth.ts");
  const acceptance = read("../e2e/auth.spec.ts");
  assert.match(readiness, /import \{ SELECTORS \} from "\.\.\/src\/config"/);
  assert.match(readiness, /SELECTORS\.primary\.chatList/);
  assert.match(readiness, /SELECTORS\.fallback\.chatList/);
  assert.match(readiness, /export function whatsappChatTarget/);
  assert.match(readiness, /containerTarget\.or\(fallbackRowTarget\)/);
  assert.match(provisioner, /authenticatedWhatsAppReady\(whatsapp\)/);
  assert.match(acceptance, /authenticatedWhatsAppReady\(page\)/);
  assert.match(acceptance, /whatsappChatTarget\(page, targetChat!\)/);
  assert.doesNotMatch(provisioner, /data-testid=\\?"chat-list/);
  assert.doesNotMatch(acceptance, /data-testid=\\?"chat-list/);
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
  for (const local of [
    { crc: 122, compressedSize: 0, uncompressedSize: 0 },
    { crc: 0, compressedSize: 455, uncompressedSize: 0 },
    { crc: 0, compressedSize: 0, uncompressedSize: 788 },
  ]) {
    assert.throws(
      () => verifyLocalEntryIntegrity({ ...entry, flags: 0x08 }, local),
      /local entry sizes or CRC are inconsistent/,
    );
  }
});

test("requires a complete and consistent ZIP data descriptor", () => {
  const entry = {
    name: "manifest.json",
    flags: 0x08,
    crc: 123,
    compressedSize: 456,
    uncompressedSize: 789,
  };
  const unsigned = Buffer.alloc(12);
  unsigned.writeUInt32LE(entry.crc, 0);
  unsigned.writeUInt32LE(entry.compressedSize, 4);
  unsigned.writeUInt32LE(entry.uncompressedSize, 8);
  assert.doesNotThrow(() => verifyDataDescriptor(unsigned, 0, entry));

  const signed = Buffer.alloc(16);
  signed.writeUInt32LE(0x08074b50, 0);
  unsigned.copy(signed, 4);
  assert.doesNotThrow(() => verifyDataDescriptor(signed, 0, entry));
  const signatureCrcEntry = { ...entry, crc: 0x08074b50 };
  const ambiguousUnsigned = Buffer.alloc(12);
  ambiguousUnsigned.writeUInt32LE(signatureCrcEntry.crc, 0);
  ambiguousUnsigned.writeUInt32LE(signatureCrcEntry.compressedSize, 4);
  ambiguousUnsigned.writeUInt32LE(signatureCrcEntry.uncompressedSize, 8);
  assert.doesNotThrow(() =>
    verifyDataDescriptor(ambiguousUnsigned, 0, signatureCrcEntry),
  );
  assert.throws(
    () => verifyDataDescriptor(signed.subarray(0, 15), 0, entry),
    /data descriptor is truncated/,
  );
  signed.writeUInt32LE(entry.crc + 1, 4);
  assert.throws(
    () => verifyDataDescriptor(signed, 0, entry),
    /data descriptor is inconsistent/,
  );
});

test("rejects a central ZIP entry assigned to another disk", () => {
  assert.doesNotThrow(() => verifySingleDiskEntry(0, "manifest.json"));
  assert.throws(
    () => verifySingleDiskEntry(1, "manifest.json"),
    /entry starts on an unsupported disk/,
  );
});

test("requires a complete, internally consistent single-disk ZIP EOCD", () => {
  const record = {
    diskNumber: 0,
    centralDisk: 0,
    entriesOnDisk: 13,
    entryCount: 13,
    eocdOffset: 100,
    commentLength: 4,
    archiveLength: 126,
  };
  assert.doesNotThrow(() => verifyEndOfCentralDirectory(record));
  assert.throws(
    () => verifyEndOfCentralDirectory({ ...record, entriesOnDisk: 12 }),
    /single-disk entry counts are inconsistent/,
  );
  assert.throws(
    () => verifyEndOfCentralDirectory({ ...record, archiveLength: 125 }),
    /comment length is inconsistent/,
  );
  assert.doesNotThrow(() => verifyCentralDirectoryExtent(40, 60, 100));
  assert.throws(
    () => verifyCentralDirectoryExtent(40, 59, 100),
    /central directory does not end at the EOCD/,
  );
});

test("accepts only the supported ZIP extraction versions and flags", () => {
  const entry = {
    name: "manifest.json",
    versionNeeded: 20,
    compressionMethod: 8,
    flags: 0x08,
  };
  assert.doesNotThrow(() => verifyEntryRequirements(entry, 20));
  assert.throws(
    () => verifyEntryRequirements({ ...entry, versionNeeded: 99 }, 99),
    /requires an unsupported version/,
  );
  assert.throws(
    () => verifyEntryRequirements(entry, 10),
    /requires an unsupported version/,
  );
  assert.throws(
    () => verifyEntryRequirements({ ...entry, flags: 0x48 }, 20),
    /uses unsupported flags/,
  );
});

test("rejects ZIP entries that are not regular files", () => {
  assert.doesNotThrow(() =>
    verifyRegularFileEntry(3, 0x81b60020, "manifest.json"),
  );
  assert.throws(
    () => verifyRegularFileEntry(3, 0xa1ff0020, "manifest.json"),
    /entry is not a regular file/,
  );
  assert.throws(
    () => verifyRegularFileEntry(3, 0x81b60030, "manifest.json"),
    /entry is not a regular file/,
  );
  assert.throws(
    () => verifyRegularFileEntry(0, 0x10, "manifest.json"),
    /entry is not a regular file/,
  );
  assert.throws(
    () => verifyRegularFileEntry(0, 0x08, "manifest.json"),
    /entry is not a regular file/,
  );
  assert.throws(
    () => verifyRegularFileEntry(5, 0xa1ff0020, "manifest.json"),
    /entry uses an unsupported creator system/,
  );
  assert.throws(
    () => verifyRegularFileEntry(16, 0x81b60020, "manifest.json"),
    /entry uses an unsupported creator system/,
  );
});

test("bounds complete local ZIP records before the central directory", () => {
  assert.doesNotThrow(() =>
    verifyLocalRecordExtent(10, 99, 100, "manifest.json"),
  );
  assert.throws(
    () => verifyLocalRecordExtent(100, 120, 100, "manifest.json"),
    /local entry overlaps the central directory/,
  );
  assert.throws(
    () => verifyLocalRecordExtent(10, 101, 100, "manifest.json"),
    /local entry overlaps the central directory/,
  );
});

test("rejects overlaps between complete local ZIP records", () => {
  const records = [
    { start: 0, end: 100, name: "manifest.json" },
    { start: 100, end: 150, name: "dist/background.js" },
  ];
  assert.doesNotThrow(() => verifyNonOverlappingLocalRecords(records));
  assert.doesNotThrow(() =>
    verifyNonOverlappingLocalRecords([...records].reverse()),
  );
  assert.throws(
    () =>
      verifyNonOverlappingLocalRecords([
        records[0],
        { ...records[1], start: 99 },
      ]),
    /local entries overlap: manifest\.json and dist\/background\.js/,
  );
});

test("rejects Unicode path overrides and malformed ZIP extra fields", () => {
  const timestamp = Buffer.alloc(9);
  timestamp.writeUInt16LE(0x5455, 0);
  timestamp.writeUInt16LE(5, 2);
  assert.doesNotThrow(() =>
    verifyExtraFields(timestamp, 0, timestamp.length, "manifest.json"),
  );

  const unicodePath = Buffer.alloc(9);
  unicodePath.writeUInt16LE(0x7075, 0);
  unicodePath.writeUInt16LE(5, 2);
  assert.throws(
    () =>
      verifyExtraFields(unicodePath, 0, unicodePath.length, "manifest.json"),
    /entry uses a filename override/,
  );
  assert.throws(
    () => verifyExtraFields(Buffer.alloc(3), 0, 3, "manifest.json"),
    /extra fields are malformed/,
  );
  assert.throws(
    () =>
      verifyExtraFields(timestamp, 0, timestamp.length - 1, "manifest.json"),
    /extra fields are malformed/,
  );
  assert.throws(
    () => verifyExtraFields(timestamp, 1, timestamp.length, "manifest.json"),
    /extra fields are truncated/,
  );
});
