import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  findConversationRoot,
  findMessageContainers,
  findMessageEmojiText,
  findMessageRecord,
  findReplyTargetId,
  findSelfDisplayName,
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
    querySelectorAll: (selector: string) =>
      selector.includes(MESSAGE_TEXT_SELECTOR) ? [genericText] : [],
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

test("keeps the original visual bubble when detecting outgoing messages", () => {
  const contentSource = readFileSync(
    new URL("../src/content.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    contentSource,
    /container\.classList\.contains\("message-out"\)/,
  );
  assert.match(
    contentSource,
    /container\.closest\('\[data-testid="msg-out"\]'\)/,
  );
  assert.match(
    contentSource,
    /messageRecord\.querySelector\('\[data-testid="msg-out"\]'\)/,
  );
});

test("discovers textless media and reply records alongside configured bubbles", () => {
  const directRecord = { closest: () => directRecord };
  const mediaRecord = {};
  const replyRecord = {};
  const mediaEvidence = { closest: () => mediaRecord };
  const replyEvidence = { closest: () => replyRecord };
  const root = {
    querySelectorAll: (selector: string) => {
      if (selector === ".configured, .fallback") return [directRecord];
      return [mediaEvidence, replyEvidence];
    },
    contains: () => true,
  };

  assert.deepEqual(
    findMessageContainers(
      root as unknown as Element,
      ".configured",
      ".fallback",
    ),
    [directRecord, mediaRecord, replyRecord],
  );
});

test("ignores quoted text while retaining emoji-only content and reply identity", () => {
  const quotedWrapper = {};
  const quotedText = { closest: () => quotedWrapper };
  const emoji = {
    closest: () => null,
    getAttribute: (name: string) => (name === "alt" ? "👍" : null),
  };
  const quoted = {
    getAttribute: (name: string) =>
      name === "data-quoted-message-id" ? "fixture-001" : null,
  };
  const record = {
    matches: () => false,
    querySelectorAll: (selector: string) =>
      selector.includes("msg-text")
        ? [quotedText]
        : selector.includes("emoji")
          ? [emoji]
          : [],
    querySelector: () => quoted,
    getAttribute: (name: string) =>
      name === "data-id" ? "fixture-current" : null,
  };

  assert.equal(
    findMessageText(
      record as unknown as Element,
      "[data-testid=msg-text]",
      ".text",
    ),
    null,
  );
  assert.equal(findMessageEmojiText(record as unknown as Element), "👍");
  assert.equal(findReplyTargetId(record as unknown as Element), "fixture-001");
});

test("reads only a specifically scoped self profile display name", () => {
  const profileImage = {
    getAttribute: (name: string) => (name === "alt" ? "Fixture Owner" : null),
  };
  const root = {
    querySelector: (selector: string) =>
      selector === '[aria-label="Profile"] img[alt]' ? profileImage : null,
  };

  assert.equal(
    findSelfDisplayName(root as unknown as ParentNode),
    "Fixture Owner",
  );
});
