import type { Locator, Page } from "@playwright/test";
import { SELECTORS } from "../src/config";

export function authenticatedWhatsAppReady(page: Page): Locator {
  return page
    .locator(`${SELECTORS.primary.chatList}, ${SELECTORS.fallback.chatList}`)
    .first();
}
