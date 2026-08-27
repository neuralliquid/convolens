import { copyFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const extensionDir = fileURLToPath(new URL("../", import.meta.url));
const distDir = resolve(extensionDir, "dist");

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });

await Promise.all([
  build({
    entryPoints: [resolve(extensionDir, "src/content.ts")],
    bundle: true,
    outfile: resolve(distDir, "content.js"),
    format: "iife",
    platform: "browser",
    target: "chrome111",
  }),
  build({
    entryPoints: [resolve(extensionDir, "src/whatsapp-page-identity.ts")],
    bundle: true,
    outfile: resolve(distDir, "whatsapp-page-identity.js"),
    format: "iife",
    platform: "browser",
    target: "chrome111",
  }),
  build({
    entryPoints: [resolve(extensionDir, "src/session-bridge.ts")],
    bundle: true,
    outfile: resolve(distDir, "session-bridge.js"),
    format: "iife",
    platform: "browser",
    target: "chrome111",
  }),
  build({
    entryPoints: [resolve(extensionDir, "src/background.ts")],
    bundle: true,
    outfile: resolve(distDir, "background.js"),
    format: "esm",
    platform: "browser",
    target: "chrome111",
  }),
  copyFile(
    resolve(extensionDir, "src/content.css"),
    resolve(distDir, "content.css"),
  ),
]);

console.log(`Built extension runtime in ${distDir}`);
