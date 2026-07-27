import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  findConversationRoot,
  findMessageContainers,
  findMessageRecord,
  findMessageText,
  MESSAGE_TEXT_SELECTOR,
} from "../src/dom-selectors.ts";

test("registers the popup receiver before waiting for WhatsApp DOM readiness", () => {
  const contentSource = readFileSync(
    new URL("../src/content.ts", import.meta.url),
    "utf8",
  );
  const receiverRegistration = contentSource.indexOf(
    "chrome.runtime.onMessage.addListener(handleMessage)",
  );
  const readinessWait = contentSource.indexOf("await waitForWhatsAppReady()");

  assert.notEqual(receiverRegistration, -1);
  assert.notEqual(readinessWait, -1);
  assert.ok(receiverRegistration < readinessWait);
});

test("falls back to the active #main conversation when WhatsApp removes its message-list wrapper", () => {
  const message = {};
  const main = {
    querySelector: (selector: string) =>
      selector.includes("selectable-text") ? message : null,
  };
  const documentRoot = {
    querySelector: (selector: string) => (selector === "#main" ? main : null),
  };

  assert.equal(
    findConversationRoot(
      documentRoot as unknown as ParentNode,
      '[data-testid="conversation-panel-messages"]',
      ".message-list",
    ),
    main,
  );
});

test("derives unique message records from selectable text when bubble selectors change", () => {
  const firstContainer = {};
  const secondContainer = {};
  const textNodes = [
    { closest: () => firstContainer },
    { closest: () => firstContainer },
    { closest: () => secondContainer },
  ];
  const root = {
    querySelectorAll: (selector: string) =>
      selector.includes("selectable-text") ? textNodes : [],
    contains: () => true,
  };

  assert.deepEqual(
    findMessageContainers(
      root as unknown as Element,
      '[data-testid="msg-container"]',
      ".message-in, .message-out",
    ),
    [firstContainer, secondContainer],
  );
});

test("reads text through the generic selector used for container discovery", () => {
  const genericText = { textContent: "Current WhatsApp message" };
  const container = {
    matches: () => false,
    querySelector: (selector: string) =>
      selector === MESSAGE_TEXT_SELECTOR ? genericText : null,
  };

  assert.equal(
    findMessageText(
      container as unknown as Element,
      '[data-testid="msg-text"]',
      ".selectable-text.copyable-text[dir]",
    ),
    genericText,
  );
});

test("normalizes a visual bubble to its enclosing WhatsApp message record", () => {
  const record = {};
  const bubble = { closest: () => record };

  assert.equal(findMessageRecord(bubble as unknown as HTMLElement), record);
});
