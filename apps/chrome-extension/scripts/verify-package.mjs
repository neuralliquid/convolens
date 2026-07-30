import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
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

export function inspectZip(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const centralDisk = buffer.readUInt16LE(eocdOffset + 6);
  if (diskNumber !== 0 || centralDisk !== 0) {
    throw new Error("Multi-disk ZIP files are not supported.");
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (centralOffset + centralSize > eocdOffset) {
    throw new Error("ZIP central directory is outside the archive bounds.");
  }

  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== ZIP_CENTRAL_SIGNATURE) {
      throw new Error(`ZIP central entry ${index + 1} is malformed.`);
    }
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    const name = buffer.toString("utf8", nameStart, nameEnd);
    if (!name || uncompressedSize === 0) {
      throw new Error(`ZIP entry ${name || index + 1} is empty.`);
    }
    if (
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").includes("..")
    ) {
      throw new Error(`ZIP entry has an unsafe path: ${name}`);
    }
    entries.push(name);
    cursor = nameEnd + extraLength + commentLength;
  }

  if (cursor !== centralOffset + centralSize) {
    throw new Error("ZIP central-directory size does not match its entries.");
  }
  if (new Set(entries).size !== entries.length) {
    throw new Error("ZIP contains duplicate entry names.");
  }
  return entries.sort();
}

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
  `Verified extension ${manifest.version} ZIP: ${entries.length} expected non-empty entries, no duplicates or unsafe paths.`,
);
