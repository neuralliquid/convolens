import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTOMATIC_CAPTURE_SAFETY_CAP,
  automaticBoundaryStopReason,
  automaticDateCutoff,
  automaticDateBoundaryStartIndex,
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

test("aligns the cutoff with WhatsApp wall-clock timestamps", () => {
  const startedAt = new Date("2026-07-28T13:00:00.000Z");
  startedAt.getFullYear = () => 2026;
  startedAt.getMonth = () => 6;
  startedAt.getDate = () => 29;
  startedAt.getHours = () => 1;
  startedAt.getMinutes = () => 0;
  startedAt.getSeconds = () => 0;
  startedAt.getMilliseconds = () => 0;

  assert.equal(
    automaticDateCutoff({ kind: "days", days: 7 }, startedAt),
    Date.UTC(2026, 6, 22, 1, 0, 0, 0),
  );
});

test("trims a boundary-spanning window after the last trusted old message", () => {
  assert.equal(
    automaticDateBoundaryStartIndex(
      [
        "2026-07-20T12:00:00.000Z",
        undefined,
        "2026-07-21T12:00:01.000Z",
        "2026-07-24T12:00:00.000Z",
      ],
      { kind: "days", days: 7 },
      new Date("2026-07-29T12:00:00.000Z"),
    ),
    3,
  );
});

test("stops date capture only from a trusted oldest timestamp", () => {
  const startedAt = new Date("2026-07-29T12:00:00.000Z");
  const boundary = { kind: "days", days: 7 } as const;
  assert.equal(
    automaticBoundaryStopReason({
      boundary,
      extractedCount: AUTOMATIC_CAPTURE_SAFETY_CAP,
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
