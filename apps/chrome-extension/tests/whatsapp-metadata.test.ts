import assert from "node:assert/strict";
import test from "node:test";
import { parseWhatsAppMessageMetadata } from "../src/whatsapp-metadata.ts";

test("preserves the sender and historical date from WhatsApp pre-plain-text metadata", () => {
  const metadata = parseWhatsAppMessageMetadata("[19:10, 06/07/2026] ~ Shane: ", "en-ZA");

  assert.equal(metadata.sender, "~ Shane");
  assert.ok(metadata.timestamp?.startsWith("2026-07-06T"));
});

test("uses the source locale for month-first WhatsApp metadata", () => {
  const metadata = parseWhatsAppMessageMetadata("[7:10 PM, 7/27/2026] Sarah Mokoena: ", "en-US");

  assert.ok(metadata.timestamp?.startsWith("2026-07-27T19:10:00"));
});

test("rejects invalid metadata dates instead of normalizing them", () => {
  const metadata = parseWhatsAppMessageMetadata("[19:10, 31/13/2026] ~ Shane: ", "en-ZA");

  assert.equal(metadata.timestamp, undefined);
});

test("supports WhatsApp metadata that places the date before the time", () => {
  const metadata = parseWhatsAppMessageMetadata("[2026-07-27, 10:02] Sarah Mokoena: ");

  assert.equal(metadata.sender, "Sarah Mokoena");
  assert.ok(metadata.timestamp?.startsWith("2026-07-27T"));
});
