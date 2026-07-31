import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_DESCRIPTOR_SIGNATURE = 0x08074b50;
const EXPECTED_ENTRIES = [
  "dist/background.js",
  "dist/content.css",
  "dist/content.js",
  "icons/icon-128.png",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon.svg",
  "manifest.json",
  "options/options.html",
  "options/options.js",
  "popup/popup.html",
  "popup/popup.js",
].sort();

function findEndOfCentralDirectory(buffer) {
  const earliest = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= earliest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) return offset;
  }
  throw new Error("ZIP end-of-central-directory record is missing.");
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function verifyLocalEntryIntegrity(
  entry,
  { crc, compressedSize, uncompressedSize },
) {
  const usesDescriptor = (entry.flags & 0x08) !== 0;
  const matches = usesDescriptor
    ? (crc === 0 || crc === entry.crc) &&
      (compressedSize === 0 || compressedSize === entry.compressedSize) &&
      (uncompressedSize === 0 || uncompressedSize === entry.uncompressedSize)
    : crc === entry.crc &&
      compressedSize === entry.compressedSize &&
      uncompressedSize === entry.uncompressedSize;
  if (!matches) {
    throw new Error(`ZIP local entry sizes or CRC are inconsistent: ${entry.name}`);
  }
}

export function verifyDataDescriptor(buffer, offset, entry) {
  if (offset + 12 > buffer.length) {
    throw new Error(`ZIP data descriptor is truncated: ${entry.name}`);
  }
  const matchesAt = (cursor) =>
    buffer.readUInt32LE(cursor) === entry.crc &&
    buffer.readUInt32LE(cursor + 4) === entry.compressedSize &&
    buffer.readUInt32LE(cursor + 8) === entry.uncompressedSize;
  if (matchesAt(offset)) return 12;

  const hasSignature =
    buffer.readUInt32LE(offset) === ZIP_DESCRIPTOR_SIGNATURE;
  if (hasSignature && offset + 16 <= buffer.length && matchesAt(offset + 4)) {
    return 16;
  }
  if (
    hasSignature &&
    entry.crc !== ZIP_DESCRIPTOR_SIGNATURE &&
    offset + 16 > buffer.length
  ) {
    throw new Error(`ZIP data descriptor is truncated: ${entry.name}`);
  }
  throw new Error(`ZIP data descriptor is inconsistent: ${entry.name}`);
}

export function verifySingleDiskEntry(diskNumberStart, name) {
  if (diskNumberStart !== 0) {
    throw new Error(`ZIP entry starts on an unsupported disk: ${name}`);
  }
}

export function verifyEndOfCentralDirectory({
  diskNumber,
  centralDisk,
  entriesOnDisk,
  entryCount,
  eocdOffset,
  commentLength,
  archiveLength,
}) {
  if (diskNumber !== 0 || centralDisk !== 0) {
    throw new Error("Multi-disk ZIP files are not supported.");
  }
  if (entriesOnDisk !== entryCount) {
    throw new Error("ZIP single-disk entry counts are inconsistent.");
  }
  if (eocdOffset + 22 + commentLength !== archiveLength) {
    throw new Error("ZIP end-of-central-directory comment length is inconsistent.");
  }
}

export function verifyCentralDirectoryExtent(
  centralOffset,
  centralSize,
  eocdOffset,
) {
  if (centralOffset + centralSize !== eocdOffset) {
    throw new Error("ZIP central directory does not end at the EOCD.");
  }
}

export function verifyEntryRequirements(entry, localVersionNeeded) {
  if (
    localVersionNeeded !== entry.versionNeeded ||
    entry.versionNeeded < 10 ||
    entry.versionNeeded > 20 ||
    (entry.compressionMethod === 8 && entry.versionNeeded < 20)
  ) {
    throw new Error(`ZIP entry requires an unsupported version: ${entry.name}`);
  }
  const allowedFlags = 0x0808 | (entry.compressionMethod === 8 ? 0x0006 : 0);
  if ((entry.flags & ~allowedFlags) !== 0) {
    throw new Error(`ZIP entry uses unsupported flags: ${entry.name}`);
  }
}

export function verifyRegularFileEntry(creatorSystem, externalAttributes, name) {
  if ((externalAttributes & 0x18) !== 0) {
    throw new Error(`ZIP entry is not a regular file: ${name}`);
  }
  if (creatorSystem === 3) {
    const unixFileType = (externalAttributes >>> 16) & 0xf000;
    if (unixFileType !== 0x8000) {
      throw new Error(`ZIP entry is not a regular file: ${name}`);
    }
    return;
  }
}

export function verifyLocalRecordExtent(
  localHeaderOffset,
  recordEnd,
  centralOffset,
  name,
) {
  if (localHeaderOffset >= centralOffset || recordEnd > centralOffset) {
    throw new Error(`ZIP local entry overlaps the central directory: ${name}`);
  }
}

export function verifyNonOverlappingLocalRecords(records) {
  const ordered = [...records].sort((left, right) => left.start - right.start);
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (current.start < previous.end) {
      throw new Error(
        `ZIP local entries overlap: ${previous.name} and ${current.name}`,
      );
    }
  }
}

export function verifyExtraFields(buffer, start, length, name) {
  const end = start + length;
  if (end > buffer.length) {
    throw new Error(`ZIP extra fields are truncated: ${name}`);
  }
  let cursor = start;
  while (cursor < end) {
    if (cursor + 4 > end) {
      throw new Error(`ZIP extra fields are malformed: ${name}`);
    }
    const headerId = buffer.readUInt16LE(cursor);
    const dataLength = buffer.readUInt16LE(cursor + 2);
    cursor += 4;
    if (cursor + dataLength > end) {
      throw new Error(`ZIP extra fields are malformed: ${name}`);
    }
    if (headerId === 0x7075) {
      throw new Error(`ZIP entry uses a filename override: ${name}`);
    }
    cursor += dataLength;
  }
}

function verifyEntryPayload(buffer, entry, centralOffset) {
  const offset = entry.localHeaderOffset;
  if (
    offset + 30 > buffer.length ||
    buffer.readUInt32LE(offset) !== ZIP_LOCAL_SIGNATURE
  ) {
    throw new Error(`ZIP entry has an invalid local header: ${entry.name}`);
  }
  const localVersionNeeded = buffer.readUInt16LE(offset + 4);
  const localFlags = buffer.readUInt16LE(offset + 6);
  const localMethod = buffer.readUInt16LE(offset + 8);
  const localCrc = buffer.readUInt32LE(offset + 14);
  const localCompressedSize = buffer.readUInt32LE(offset + 18);
  const localUncompressedSize = buffer.readUInt32LE(offset + 22);
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const nameStart = offset + 30;
  const dataStart = nameStart + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  verifyExtraFields(buffer, nameStart + nameLength, extraLength, entry.name);
  if (
    buffer.toString("utf8", nameStart, nameStart + nameLength) !== entry.name ||
    localFlags !== entry.flags ||
    localMethod !== entry.compressionMethod ||
    dataEnd > buffer.length
  ) {
    throw new Error(`ZIP local entry metadata is inconsistent: ${entry.name}`);
  }
  if ((entry.flags & 1) !== 0) {
    throw new Error(`ZIP entry must not be encrypted: ${entry.name}`);
  }
  verifyEntryRequirements(entry, localVersionNeeded);
  verifyLocalEntryIntegrity(entry, {
    crc: localCrc,
    compressedSize: localCompressedSize,
    uncompressedSize: localUncompressedSize,
  });
  const descriptorLength =
    (entry.flags & 0x08) !== 0
      ? verifyDataDescriptor(buffer, dataEnd, entry)
      : 0;
  const recordEnd = dataEnd + descriptorLength;
  verifyLocalRecordExtent(offset, recordEnd, centralOffset, entry.name);

  const compressed = buffer.subarray(dataStart, dataEnd);
  const payload =
    entry.compressionMethod === 0
      ? compressed
      : entry.compressionMethod === 8
        ? inflateRawSync(compressed)
        : null;
  if (!payload) {
    throw new Error(
      `ZIP entry uses unsupported compression method ${entry.compressionMethod}: ${entry.name}`,
    );
  }
  if (
    payload.length !== entry.uncompressedSize ||
    payload.length === 0 ||
    crc32(payload) !== entry.crc
  ) {
    throw new Error(
      `ZIP entry payload failed size or CRC verification: ${entry.name}`,
    );
  }
  return { start: offset, end: recordEnd, name: entry.name };
}

export function inspectZip(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const centralDisk = buffer.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocdOffset + 8);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const commentLength = buffer.readUInt16LE(eocdOffset + 20);
  verifyEndOfCentralDirectory({
    diskNumber,
    centralDisk,
    entriesOnDisk,
    entryCount,
    eocdOffset,
    commentLength,
    archiveLength: buffer.length,
  });
  const centralSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  verifyCentralDirectoryExtent(centralOffset, centralSize, eocdOffset);

  const entries = [];
  const localRecords = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== ZIP_CENTRAL_SIGNATURE) {
      throw new Error(`ZIP central entry ${index + 1} is malformed.`);
    }
    const entry = {
      creatorSystem: buffer.readUInt8(cursor + 5),
      versionNeeded: buffer.readUInt16LE(cursor + 6),
      flags: buffer.readUInt16LE(cursor + 8),
      compressionMethod: buffer.readUInt16LE(cursor + 10),
      crc: buffer.readUInt32LE(cursor + 16),
      compressedSize: buffer.readUInt32LE(cursor + 20),
      uncompressedSize: buffer.readUInt32LE(cursor + 24),
      diskNumberStart: buffer.readUInt16LE(cursor + 34),
      externalAttributes: buffer.readUInt32LE(cursor + 38),
      localHeaderOffset: buffer.readUInt32LE(cursor + 42),
    };
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    const name = buffer.toString("utf8", nameStart, nameEnd);
    if (!name || entry.uncompressedSize === 0) {
      throw new Error(`ZIP entry ${name || index + 1} is empty.`);
    }
    verifySingleDiskEntry(entry.diskNumberStart, name);
    verifyRegularFileEntry(entry.creatorSystem, entry.externalAttributes, name);
    verifyExtraFields(buffer, nameEnd, extraLength, name);
    if (
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").includes("..")
    ) {
      throw new Error(`ZIP entry has an unsafe path: ${name}`);
    }
    localRecords.push(
      verifyEntryPayload(buffer, { ...entry, name }, centralOffset),
    );
    entries.push(name);
    cursor = nameEnd + extraLength + commentLength;
  }

  if (cursor !== centralOffset + centralSize) {
    throw new Error("ZIP central-directory size does not match its entries.");
  }
  if (new Set(entries).size !== entries.length) {
    throw new Error("ZIP contains duplicate entry names.");
  }
  verifyNonOverlappingLocalRecords(localRecords);
  return entries.sort();
}

async function main() {
  const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8"));
  const manifest = JSON.parse(await readFile(resolve("manifest.json"), "utf8"));
  if (packageJson.version !== manifest.version) {
    throw new Error(
      `Version mismatch: package ${packageJson.version}, manifest ${manifest.version}.`,
    );
  }

  const archivePath = resolve("convolens-extension.zip");
  const entries = inspectZip(await readFile(archivePath));
  if (JSON.stringify(entries) !== JSON.stringify(EXPECTED_ENTRIES)) {
    throw new Error(
      `Unexpected ZIP entries. Expected ${EXPECTED_ENTRIES.join(", ")}; received ${entries.join(", ")}.`,
    );
  }

  console.log(
    `Verified extension ${manifest.version} ZIP: ${entries.length} expected payloads decompressed with matching sizes and CRCs, no duplicates or unsafe paths.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
