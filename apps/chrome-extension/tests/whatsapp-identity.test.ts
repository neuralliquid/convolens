import assert from "node:assert/strict";
import test from "node:test";
import {
  combineSenderEvidence,
  extractStableWhatsAppConversationId,
} from "../src/whatsapp-identity";

test("retains a visible name and metadata phone independently", () => {
  assert.deepEqual(
    combineSenderEvidence({
      metadataSender: "+27 76 138 8725",
      visibleSender: "Greg Wright",
    }),
    {
      rawDisplayName: "Greg Wright",
      normalizedPhone: "+27761388725",
      displayLabel: "Greg Wright · +27761388725",
    },
  );
});

test("retains name-only and phone-only evidence", () => {
  assert.equal(
    combineSenderEvidence({ metadataSender: "Sarah" }).displayLabel,
    "Sarah",
  );
  assert.equal(
    combineSenderEvidence({ metadataSender: "+27 82 123 4567" }).displayLabel,
    "+27821234567",
  );
});

test("separates a combined visible name and phone label", () => {
  assert.deepEqual(
    combineSenderEvidence({ metadataSender: "Greg Wright · +27 76 138 8725" }),
    {
      rawDisplayName: "Greg Wright",
      normalizedPhone: "+27761388725",
      displayLabel: "Greg Wright · +27761388725",
    },
  );
});

test("does not fabricate phone evidence from dates or numeric identifiers", () => {
  assert.deepEqual(
    combineSenderEvidence({ metadataSender: "Team 2026-07-28" }),
    {
      rawDisplayName: "Team 2026-07-28",
      normalizedPhone: undefined,
      displayLabel: "Team 2026-07-28",
    },
  );
  assert.deepEqual(combineSenderEvidence({ metadataSender: "Shop 123456" }), {
    rawDisplayName: "Shop 123456",
    normalizedPhone: undefined,
    displayLabel: "Shop 123456",
  });
  assert.equal(
    combineSenderEvidence({ metadataSender: "2026-07-28" }).normalizedPhone,
    undefined,
  );
});

test("uses only a WhatsApp JID as stable conversation identity", () => {
  assert.equal(
    extractStableWhatsAppConversationId(["false_120363123456789@g.us_ABCD"]),
    "whatsapp:120363123456789@g.us",
  );
  assert.equal(
    extractStableWhatsAppConversationId(["true_123456789012345@lid_ABCD"]),
    "whatsapp:123456789012345@lid",
  );
  assert.equal(
    extractStableWhatsAppConversationId(["Team chat", "message_123"]),
    undefined,
  );
});
