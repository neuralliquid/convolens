import { chromium, expect, test } from "@playwright/test";
import { isAbsolute, relative, resolve } from "node:path";

const enabled = process.env.CONVOLENS_AUTHENTIC_ACCEPTANCE === "1";
const profileDir = process.env.CONVOLENS_PW_PROFILE_DIR;
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const relativeProfilePath = profileDir
  ? relative(repositoryRoot, resolve(profileDir))
  : "";
const profileInsideRepository =
  relativeProfilePath === "" ||
  (!relativeProfilePath.startsWith("..") && !isAbsolute(relativeProfilePath));

test.describe("operator-held authentic extension acceptance", () => {
  test.skip(
    !enabled,
    "Set CONVOLENS_AUTHENTIC_ACCEPTANCE=1 to authorize an authentic read-only run.",
  );
  test.skip(
    !profileDir || !isAbsolute(profileDir) || profileInsideRepository,
    "CONVOLENS_PW_PROFILE_DIR must name an absolute, provisioned profile outside the repository.",
  );

  test("loads the authenticated extension without sending", async () => {
    const extensionPath = resolve(import.meta.dirname, "..");
    const context = await chromium.launchPersistentContext(
      resolve(profileDir!),
      {
        channel: "chromium",
        headless: false,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
        ],
      },
    );
    try {
      const page = await context.newPage();
      await page.goto("https://web.whatsapp.com/");
      await page
        .locator('[data-testid="chat-list"], #pane-side')
        .first()
        .waitFor();
      await page.locator("#convolens-fab").waitFor();
      await page.locator("#ws-launcher-toggle").click();
      await expect(page.locator("#ws-extract-btn")).toBeEnabled();
      await expect(page.locator("#ws-status-text")).not.toContainText(
        "Sign in",
      );
    } finally {
      await context.close();
    }
  });

  test("sends one explicitly allowlisted reviewed capture", async () => {
    test.skip(
      process.env.CONVOLENS_ALLOW_SEND !== "1",
      "Sending is disabled by default.",
    );
    test.skip(
      process.env.CONVOLENS_SEND_CONFIRMATION !==
        "I authorize one ConvoLens intake",
      "Set the exact one-intake confirmation phrase.",
    );
    const targetChat = process.env.CONVOLENS_TEST_CHAT;
    test.skip(
      !targetChat,
      "CONVOLENS_TEST_CHAT must identify the dedicated test chat.",
    );

    const extensionPath = resolve(import.meta.dirname, "..");
    const context = await chromium.launchPersistentContext(
      resolve(profileDir!),
      {
        channel: "chromium",
        headless: false,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
        ],
      },
    );
    try {
      const page = await context.newPage();
      await page.goto("https://web.whatsapp.com/");
      await page
        .locator('[data-testid="chat-list"], #pane-side')
        .first()
        .waitFor();
      await page.getByText(targetChat!, { exact: true }).first().click();
      await page.locator("#convolens-fab").waitFor();
      await page.locator("#ws-launcher-toggle").click();
      await page.locator("#ws-extract-btn").click();
      await expect(page.locator("#ws-status-text")).toContainText(
        "ready for review",
      );
      await page.locator("#ws-confirm-capture").click();
      await expect(page.locator("#ws-status-text")).toContainText(
        /received by ConvoLens|already exist in ConvoLens/,
      );
    } finally {
      await context.close();
    }
  });
});
