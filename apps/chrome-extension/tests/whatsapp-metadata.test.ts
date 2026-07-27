import assert from "node:assert/strict";
import test from "node:test";
import { parseWhatsAppMessageMetadata } from "../src/whatsapp-metadata.ts";

test("preserves the sender and historical date from WhatsApp pre-plain-text metadata", () => {
  const metadata = parseWhatsAppMessageMetadata("[19:10, 06/07/2026] ~ Shane: ");

  assert.equal(metadata.sender, "~ Shane");
  assert.ok(metadata.timestamp?.startsWith("2026-07-06T"));
});

test("supports WhatsApp metadata that places the date before the time", () => {
  const metadata = parseWhatsAppMessageMetadata("[2026-07-27, 10:02] Sarah Mokoena: ");

  assert.equal(metadata.sender, "Sarah Mokoena");
  assert.ok(metadata.timestamp?.startsWith("2026-07-27T"));
});
