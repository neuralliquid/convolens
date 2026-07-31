import { defineConfig } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: e2eDir,
  testMatch: "fixture.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [
    ["line"],
    [
      "html",
      {
        outputFolder: resolve(
          e2eDir,
          "../../../playwright-report/extension-fixture",
        ),
        open: "never",
      },
    ],
  ],
  outputDir: resolve(e2eDir, "../../../test-results/extension-fixture"),
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
});
