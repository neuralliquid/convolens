import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { ZipArchive } from "archiver";

const outputPath = resolve("convolens-extension.zip");

await rm(outputPath, { force: true });

const output = createWriteStream(outputPath);
const archive = new ZipArchive({ zlib: { level: 9 } });

const completion = new Promise((resolveCompletion, rejectCompletion) => {
  output.on("close", resolveCompletion);
  output.on("error", rejectCompletion);
  archive.on("warning", rejectCompletion);
  archive.on("error", rejectCompletion);
});

archive.pipe(output);
archive.file("manifest.json", { name: "manifest.json" });
archive.directory("dist", "dist");
archive.directory("icons", "icons");
archive.directory("popup", "popup");
archive.directory("options", "options");
await archive.finalize();
await completion;

console.log(`Created ${outputPath}`);
