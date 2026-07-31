import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "persistence.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 2 * 60_000,
  reporter: "line",
  outputDir: resolve(
    import.meta.dirname,
    "../../../test-results/extension-persistence",
  ),
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
});
