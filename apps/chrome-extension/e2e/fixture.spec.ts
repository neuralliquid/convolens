import { expect, test } from "./support/extension-harness";

async function openCapturePanel(page: import("@playwright/test").Page) {
  const toggle = page.locator("#ws-launcher-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true")
    await toggle.click();
  await expect(page.locator("#ws-launcher-panel")).toBeVisible();
}

async function reviewLoadedMessages(page: import("@playwright/test").Page) {
  await openCapturePanel(page);
  const review = page.locator("#ws-extract-btn");
  await expect(review).toBeEnabled();
  await expect(review).toHaveText("Review loaded messages");
  await review.click();
  await expect(page.locator("#ws-status-text")).toHaveText(
    "3 loaded messages ready for review.",
  );
  await expect(page.locator("#ws-preview-loaded")).toHaveText("3");
}

test("loads the production extension and sends only after explicit review", async ({
  harness,
}) => {
  await reviewLoadedMessages(harness.page);
  expect(harness.apiRequests).toHaveLength(0);

  await harness.page.locator("#ws-confirm-capture").click();
  await expect(harness.page.locator("#ws-status-text")).toHaveText(
    "3 loaded messages received by ConvoLens.",
  );
  expect(harness.apiRequests).toHaveLength(1);
  expect(harness.apiRequests[0]).toMatchObject({
    authorization: "Bearer fixture-owner-a-token",
    source: "chrome-extension",
    body: {
      chatName: "Fixture Group",
      isGroup: true,
      messageCount: 3,
      source: "chrome-extension",
      sourceConversationId: "whatsapp:120363000000000000@g.us",
    },
  });
  expect(harness.apiRequests[0].correlationId).toMatch(/^ext_/);
  const messages = harness.apiRequests[0].body.messages as Array<{
    text: string;
    isOutgoing: boolean;
  }>;
  expect(messages.map((message) => message.text)).toEqual([
    "Repeatable fixture message",
    "Repeatable fixture message",
    "TODO: Synthetic reply",
  ]);
  expect(messages.filter((message) => message.isOutgoing)).toHaveLength(1);
});

test("renders deterministic duplicate evidence on a repeated reviewed capture", async ({
  harness,
}) => {
  await reviewLoadedMessages(harness.page);
  await harness.page.locator("#ws-confirm-capture").click();
  await expect(harness.page.locator("#ws-status-text")).toContainText(
    "received by ConvoLens",
  );

  await reviewLoadedMessages(harness.page);
  expect(harness.apiRequests).toHaveLength(1);
  await harness.page.locator("#ws-confirm-capture").click();
  await expect(harness.page.locator("#ws-status-text")).toHaveText(
    "3 loaded messages already exist in ConvoLens.",
  );
  expect(harness.apiRequests).toHaveLength(2);
  const canonicalMessages = (value: unknown) =>
    (value as Array<Record<string, unknown>>).map(
      ({ id: _id, ...message }) => message,
    );
  expect(canonicalMessages(harness.apiRequests[1].body.messages)).toEqual(
    canonicalMessages(harness.apiRequests[0].body.messages),
  );
});

test("invalidates a reviewed payload when the authenticated owner changes", async ({
  harness,
}) => {
  await reviewLoadedMessages(harness.page);
  expect(harness.apiRequests).toHaveLength(0);

  const login = await harness.extensionPage.evaluate(async () => {
    const chromeApi = (
      globalThis as typeof globalThis & { chrome: typeof chrome }
    ).chrome;
    return await chromeApi.runtime.sendMessage({
      action: "LOGIN",
      email: "owner-b@example.test",
      password: "fixture-only",
    });
  });
  expect(login).toMatchObject({ success: true });
  await expect(harness.page.locator("#ws-status-text")).not.toContainText(
    "ready for review",
  );
  expect(harness.apiRequests).toHaveLength(0);
});

test("attributes browser console output without leaking credentials", async ({
  harness,
}) => {
  await openCapturePanel(harness.page);
  expect(
    harness.consoleMessages.some((message) => message.source === "page"),
  ).toBe(true);
  expect(harness.serviceWorker.url()).toBe(
    `chrome-extension://${harness.extensionId}/dist/background.js`,
  );
  expect(
    harness.consoleMessages.every((message) =>
      ["page", "service-worker"].includes(message.source),
    ),
  ).toBe(true);
  const serialized = JSON.stringify(harness.consoleMessages);
  expect(serialized).not.toContain("fixture-owner-a-token");
  expect(serialized).not.toContain("fixture-only");
});
