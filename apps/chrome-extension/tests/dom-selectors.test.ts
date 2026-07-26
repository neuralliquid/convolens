import assert from "node:assert/strict";
import test from "node:test";
import {
  findConversationRoot,
  findMessageContainers,
  findMessageText,
  MESSAGE_TEXT_SELECTOR,
} from "../src/dom-selectors.ts";

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
