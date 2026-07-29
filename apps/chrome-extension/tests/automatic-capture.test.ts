import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTOMATIC_CAPTURE_SAFETY_CAP,
  automaticBoundaryStopReason,
  normalizeAutomaticBoundary,
} from "../src/automatic-capture";

test("normalizes automatic message boundaries within the safety cap", () => {
  assert.deepEqual(
    normalizeAutomaticBoundary({ kind: "messages", messageLimit: 900 }),
    { kind: "messages", messageLimit: AUTOMATIC_CAPTURE_SAFETY_CAP },
  );
  assert.deepEqual(normalizeAutomaticBoundary(undefined), {
    kind: "verified-top",
  });
});

test("stops date capture only from a trusted oldest timestamp", () => {
  const startedAt = new Date("2026-07-29T12:00:00.000Z");
  const boundary = { kind: "days", days: 7 } as const;
  assert.equal(
    automaticBoundaryStopReason({
      boundary,
      extractedCount: 20,
      oldestTrustedTimestamp: "2026-07-21T11:59:59.000Z",
      verifiedTop: false,
      startedAt,
    }),
    "automatic-date-boundary",
  );
  assert.equal(
    automaticBoundaryStopReason({
      boundary,
      extractedCount: 20,
      verifiedTop: false,
      startedAt,
    }),
    null,
  );
});

test("distinguishes message, verified-top, and safety-cap completion", () => {
  const startedAt = new Date("2026-07-29T12:00:00.000Z");
  assert.equal(
    automaticBoundaryStopReason({
      boundary: { kind: "messages", messageLimit: 100 },
      extractedCount: 100,
      verifiedTop: false,
      startedAt,
    }),
    "automatic-message-limit",
  );
  assert.equal(
    automaticBoundaryStopReason({
      boundary: { kind: "verified-top" },
      extractedCount: 40,
      verifiedTop: true,
      startedAt,
    }),
    "automatic-verified-top",
  );
  assert.equal(
    automaticBoundaryStopReason({
      boundary: { kind: "messages", messageLimit: 500 },
      extractedCount: 500,
      verifiedTop: false,
      startedAt,
    }),
    "automatic-safety-cap",
  );
});
