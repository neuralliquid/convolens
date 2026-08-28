import { cp, copyFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const packageDir = resolve(".firefox-package");

await rm(packageDir, { force: true, recursive: true });
await mkdir(packageDir, { recursive: true });

await Promise.all([
  copyFile(
    resolve("manifest.firefox.json"),
    resolve(packageDir, "manifest.json"),
  ),
  cp(resolve("dist"), resolve(packageDir, "dist"), { recursive: true }),
  cp(resolve("icons"), resolve(packageDir, "icons"), { recursive: true }),
  cp(resolve("popup"), resolve(packageDir, "popup"), { recursive: true }),
  cp(resolve("options"), resolve(packageDir, "options"), { recursive: true }),
]);

console.log(`Prepared Firefox extension in ${packageDir}`);
