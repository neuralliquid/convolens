import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { ZipArchive } from "archiver";

async function createPackage({ outputName, sourceDir = "." }) {
  const outputPath = resolve(outputName);

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
  archive.file(resolve(sourceDir, "manifest.json"), { name: "manifest.json" });
  archive.directory(resolve(sourceDir, "dist"), "dist");
  archive.directory(resolve(sourceDir, "icons"), "icons");
  archive.directory(resolve(sourceDir, "popup"), "popup");
  archive.directory(resolve(sourceDir, "options"), "options");
  await archive.finalize();
  await completion;

  console.log(`Created ${outputPath}`);
}

await createPackage({ outputName: "convolens-extension.zip" });
await createPackage({
  outputName: "convolens-extension-firefox.zip",
  sourceDir: ".firefox-package",
});
