import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  findConversationRoot,
  findMessageContainers,
  findMessageEmojiText,
  findMessageRecord,
  findMessageSender,
  findReplyTargetId,
  findSelfDisplayName,
  findMessageText,
  hasCurrentMessageEvidence,
  MESSAGE_TEXT_SELECTOR,
  resolveCapturedReplyTargets,
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

test("falls back to #main for a media-only loaded window", () => {
  const media = {};
  const main = {
    querySelector: (selector: string) =>
      selector.includes("image-content") ? media : null,
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

test("rejects broad text evidence without a message-record ancestor", () => {
  const composerDraft = { closest: () => null };
  const root = {
    querySelectorAll: () => [composerDraft],
    contains: () => true,
  };

  assert.deepEqual(
    findMessageContainers(
      root as unknown as Element,
      '[data-testid="msg-container"]',
      ".message-in, .message-out",
    ),
    [],
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

test("prefers configured message text over earlier generic preview text", () => {
  const previewText = { textContent: "Preview" };
  const messageText = { textContent: "Current message" };
  const container = {
    matches: () => false,
    querySelectorAll: (selector: string) =>
      selector === '[data-testid="msg-text"]'
        ? [messageText]
        : selector.includes("selectable-text")
          ? [previewText]
          : [],
  };

  assert.equal(
    findMessageText(
      container as unknown as Element,
      '[data-testid="msg-text"]',
      ".configured-fallback",
    ),
    messageText,
  );
});

test("prefers the configured sender over an earlier generic preview author", () => {
  const previewAuthor = { textContent: "Preview author" };
  const messageSender = { textContent: "Message sender" };
  const container = {
    querySelectorAll: (selector: string) =>
      selector === '[data-testid="msg-sender"]'
        ? [messageSender]
        : selector.includes("message-author")
          ? [previewAuthor]
          : [],
  };

  assert.equal(
    findMessageSender(
      container as unknown as Element,
      '[data-testid="msg-sender"]',
      ".configured-sender-fallback",
    ),
    messageSender,
  );
});

test("normalizes a visual bubble to its enclosing WhatsApp message record", () => {
  const record = {};
  const bubble = {
    closest: (selector: string) =>
      selector.includes("[data-id]") ? record : bubble,
  };

  assert.equal(findMessageRecord(bubble as unknown as HTMLElement), record);
});

test("prefers an outer message record over a matching visual bubble", () => {
  const outerRecord = {};
  const bubble = {
    closest: (selector: string) =>
      selector.includes("[data-id]") ? outerRecord : bubble,
  };

  assert.equal(
    findMessageRecord(bubble as unknown as HTMLElement),
    outerRecord,
  );
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
    querySelectorAll: () => [directRecord, mediaEvidence, replyEvidence],
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

test("preserves DOM order across configured and evidence-only records", () => {
  const firstRecord = { name: "first" };
  const middleRecord = { name: "middle" };
  const lastRecord = { name: "last" };
  const candidates = [
    { closest: () => firstRecord },
    { closest: () => middleRecord },
    { closest: () => lastRecord },
  ];
  const root = {
    querySelectorAll: () => candidates,
    contains: () => true,
  };

  assert.deepEqual(
    findMessageContainers(
      root as unknown as Element,
      ".configured",
      ".fallback",
    ),
    [firstRecord, middleRecord, lastRecord],
  );
});

test("climbs past quoted media previews to the enclosing message record", () => {
  const messageRecord = {};
  const quotedPreview = {
    parentElement: {
      closest: () => messageRecord,
    },
  };
  const quotedMedia = {
    closest: (selector: string) =>
      selector.includes("quoted-message") ? quotedPreview : quotedPreview,
  };
  const root = {
    querySelectorAll: () => [quotedMedia],
    contains: () => true,
  };

  assert.deepEqual(
    findMessageContainers(
      root as unknown as Element,
      ".configured",
      ".fallback",
    ),
    [messageRecord],
  );
});

test("does not classify quoted preview media as current-message evidence", () => {
  const quotedPreview = {};
  const quotedMedia = {
    closest: (selector: string) =>
      selector.includes("quoted-message") ? quotedPreview : null,
  };
  const record = {
    matches: () => false,
    querySelectorAll: () => [quotedMedia],
  };

  assert.equal(
    hasCurrentMessageEvidence(record as unknown as Element, "video"),
    false,
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

test("maps captured reply targets to exported IDs without leaking unmatched raw IDs", () => {
  const messages = [
    { id: "generated-1", captureSourceId: "fixture-001" },
    {
      id: "generated-2",
      captureSourceId: "fixture-002",
      captureReplyToSourceId: "fixture-001",
      replyTo: "stale-value",
    },
    {
      id: "generated-3",
      captureSourceId: "fixture-003",
      captureReplyToSourceId: "not-captured",
      replyTo: "stale-value",
    },
  ];

  resolveCapturedReplyTargets(messages);

  assert.equal(messages[1].replyTo, "generated-1");
  assert.equal(messages[2].replyTo, undefined);
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
