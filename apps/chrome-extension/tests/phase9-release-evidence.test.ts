import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  verifyDataDescriptor,
  verifyCentralDirectoryExtent,
  verifyEndOfCentralDirectory,
  verifyEntryRequirements,
  verifyLocalEntryIntegrity,
  verifyRegularFileEntry,
  verifySingleDiskEntry,
} from "../scripts/verify-package.mjs";

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
    () => verifyRegularFileEntry(0, 0x10, "manifest.json"),
    /entry is not a regular file/,
  );
});
