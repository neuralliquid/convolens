import { copyFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const distDir = resolve("dist");

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });

await Promise.all([
  build({
    entryPoints: ["./src/content.ts"],
    bundle: true,
    outfile: "./dist/content.js",
    format: "iife",
    platform: "browser",
    target: "chrome102",
  }),
  build({
    entryPoints: ["./src/whatsapp-page-identity.ts"],
    bundle: true,
    outfile: "./dist/whatsapp-page-identity.js",
    format: "iife",
    platform: "browser",
    target: "chrome102",
  }),
  build({
    entryPoints: ["./src/background.ts"],
    bundle: true,
    outfile: "./dist/background.js",
    format: "esm",
    platform: "browser",
    target: "chrome102",
  }),
  copyFile(resolve("src/content.css"), resolve("dist/content.css")),
]);

console.log(`Built extension runtime in ${distDir}`);
