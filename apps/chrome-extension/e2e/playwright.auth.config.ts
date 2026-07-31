import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "auth.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 10 * 60_000,
  reporter: "line",
  outputDir: resolve(
    import.meta.dirname,
    "../../../test-results/extension-auth",
  ),
  use: {
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
