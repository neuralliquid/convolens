import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contentSource = await readFile(
  new URL("../src/content.ts", import.meta.url),
  "utf8",
);
const popupSource = await readFile(
  new URL("../popup/popup.js", import.meta.url),
  "utf8",
);

test("sends only verified WhatsApp conversation identity as stable scope", () => {
  assert.match(contentSource, /extractStableWhatsAppConversationId/);
  assert.match(contentSource, /sourceConversationId/);
  assert.doesNotMatch(contentSource, /sourceConversationId:\s*generateChatId/);
});

test("surfaces conservative reconciliation in both capture entry points", () => {
  assert.match(
    contentSource,
    /stored separately\. Review the possible prior intake/,
  );
  assert.match(
    popupSource,
    /stored separately\. Review the possible prior intake/,
  );
});

test("keeps media captions separate from neutral media classification", () => {
  assert.match(contentSource, /text,\s*sender:/);
  assert.doesNotMatch(contentSource, /text:\s*isMedia\s*&&\s*!text/);
});
