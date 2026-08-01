import type { Locator, Page } from "@playwright/test";
import { SELECTORS } from "../src/config";

export function authenticatedWhatsAppReady(page: Page): Locator {
  return page
    .locator(`${SELECTORS.primary.chatList}, ${SELECTORS.fallback.chatList}`)
    .first();
}

export function whatsappChatTarget(page: Page, targetChat: string): Locator {
  const containerTarget = page
    .locator(
      `${SELECTORS.primary.chatList}, #pane-side, [aria-label="Chat list"]`,
    )
    .getByText(targetChat, { exact: true });
  const fallbackRowTarget = page
    .locator('.copyable-area [role="listitem"]')
    .getByText(targetChat, { exact: true });
  return containerTarget.or(fallbackRowTarget);
}
