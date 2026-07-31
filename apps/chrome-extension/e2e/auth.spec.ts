import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
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

async function openExtensionControlPage(
  context: BrowserContext,
): Promise<Page> {
  const worker =
    context
      .serviceWorkers()
      .find((candidate) => candidate.url().startsWith("chrome-extension://")) ||
    (await context.waitForEvent("serviceworker", {
      predicate: (candidate) =>
        candidate.url().startsWith("chrome-extension://"),
    }));
  const extensionPage = await context.newPage();
  await extensionPage.goto(
    `chrome-extension://${new URL(worker.url()).host}/options/options.html`,
  );
  return extensionPage;
}

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
      const chatList = page
        .locator('[data-testid="chat-list"], #pane-side')
        .first();
      await chatList.waitFor();
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
    const targetChatJid = process.env.CONVOLENS_TEST_CHAT_JID;
    test.skip(
      !targetChatJid,
      "CONVOLENS_TEST_CHAT_JID must identify the reviewed WhatsApp conversation.",
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
      const extensionPage = await openExtensionControlPage(context);
      const page = await context.newPage();
      await page.goto("https://web.whatsapp.com/");
      const chatList = page
        .locator('[data-testid="chat-list"], #pane-side')
        .first();
      await chatList.waitFor();
      const target = chatList.getByText(targetChat!, { exact: true });
      await expect(target).toHaveCount(1);
      await expect(target).toBeVisible();
      await target.click();
      const activeTitle = page
        .locator('[data-testid="conversation-info-header-chat-title"]')
        .first();
      await expect(activeTitle).toHaveText(targetChat!, { timeout: 30_000 });
      await page.locator("#convolens-fab").waitFor();
      await page.locator("#ws-launcher-toggle").click();
      await page.locator("#ws-extract-btn").click();
      await expect(page.locator("#ws-status-text")).toContainText(
        "ready for review",
      );
      await page.bringToFront();
      const reviewedChat = await extensionPage.evaluate(async () => {
        const chromeApi = (
          globalThis as typeof globalThis & { chrome: typeof chrome }
        ).chrome;
        const [tab] = await chromeApi.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab?.id || !tab.url?.startsWith("https://web.whatsapp.com/")) {
          return { success: false };
        }
        const operation = await chromeApi.runtime.sendMessage({
          action: "GET_CAPTURE_OPERATION",
          tabId: tab.id,
        });
        if (!operation?.success || !operation.data?.operationId) {
          return { success: false };
        }
        const preview = await chromeApi.tabs.sendMessage(tab.id, {
          action: "GET_CAPTURE_PREVIEW",
          operationId: operation.data.operationId,
        });
        const payload = await chromeApi.tabs.sendMessage(tab.id, {
          action: "GET_CAPTURE_OPERATION_PAYLOAD",
          operationId: operation.data.operationId,
        });
        return {
          success: Boolean(preview?.success && payload?.success),
          chatName: preview?.data?.chatName,
          sourceConversationId: payload?.data?.sourceConversationId,
        };
      });
      expect(reviewedChat).toEqual({
        success: true,
        chatName: targetChat,
        sourceConversationId: targetChatJid,
      });
      await expect(activeTitle).toHaveText(targetChat!);
      await page.locator("#ws-confirm-capture").click();
      await expect(page.locator("#ws-status-text")).toContainText(
        /received by ConvoLens|already exist in ConvoLens/,
      );
    } finally {
      await context.close();
    }
  });
});
