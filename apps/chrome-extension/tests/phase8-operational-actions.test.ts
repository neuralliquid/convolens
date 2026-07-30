import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { CaptureOperationSnapshot } from "../src/capture-operation";
import {
  canRestoreReviewedRetry,
  deriveToolbarBadge,
  normalizeConversationResultPath,
  operationalStateForOwner,
} from "../src/capture-operational";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const backgroundSource = read("../src/background.ts");
const contentSource = read("../src/content.ts");
const popupSource = read("../popup/popup.js");
const popupHtml = read("../popup/popup.html");
const manifest = JSON.parse(read("../manifest.json"));

function operation(
  state: CaptureOperationSnapshot["state"],
  reconciliationRequired = false,
): CaptureOperationSnapshot {
  return {
    operationId: crypto.randomUUID(),
    authGeneration: 1,
    tabId: 1,
    initiator: "popup",
    mode: "loaded",
    state,
    renderedCount: 12,
    collectedCount: 12,
    extractedCount: 12,
    skippedCount: 0,
    unreadableCount: 0,
    participantLabelCount: 2,
    alignmentWarningCount: 0,
    mediaCount: 0,
    reconciliationRequired,
    startedAt: "2026-07-29T12:00:00.000Z",
  };
}

test("accepts only exact persisted conversation result paths", () => {
  const path = "/dashboard/conversations/1d3e4567-e89b-42d3-a456-426614174000";
  assert.equal(normalizeConversationResultPath(path), path);
  assert.equal(
    normalizeConversationResultPath("https://evil.example/x"),
    undefined,
  );
  assert.equal(normalizeConversationResultPath("/dashboard"), undefined);
  assert.match(backgroundSource, /normalizeConversationResultPath\(path\)/);
  assert.match(popupHtml, /id="openConversation"/);
  assert.match(contentSource, /id="ws-open-conversation"/);
});

test("keeps preferences and last capture scoped to the authenticated owner", () => {
  const stored = {
    ownerId: "owner-a",
    preferredMode: "automatic",
    lastCapture: {
      count: 42,
      completedAt: "2026-07-29T12:01:00.000Z",
      state: "received",
      resultPath:
        "/dashboard/conversations/1d3e4567-e89b-42d3-a456-426614174000",
      reconciliationRequired: false,
    },
  };
  assert.equal(
    operationalStateForOwner(stored, "owner-a").preferredMode,
    "automatic",
  );
  assert.deepEqual(operationalStateForOwner(stored, "owner-b"), {
    preferredMode: "loaded",
  });
  assert.match(backgroundSource, /STORAGE_KEYS\.captureOperationalState/);
  assert.doesNotMatch(
    read("../src/capture-operational.ts"),
    /messages|payload/,
  );
});

test("prioritizes retry, legacy migration, then other attention in the toolbar", () => {
  assert.equal(
    deriveToolbarBadge([operation("retry-required")], 2).title,
    "ConvoLens: reviewed capture needs retry",
  );
  assert.equal(
    deriveToolbarBadge([], 2).title,
    "ConvoLens: legacy captures need export or deletion",
  );
  assert.equal(
    deriveToolbarBadge([operation("ready-for-review")], 0).title,
    "ConvoLens: capture needs attention",
  );
  assert.equal(deriveToolbarBadge([operation("received")], 0).text, "");
  assert.match(backgroundSource, /chrome\.action\.setBadgeText/);
  assert.ok(!manifest.permissions.includes("downloads"));
});

test("preserves only retry metadata across worker restart and fails closed without tab payload", () => {
  const retry = operation("retry-required");
  assert.equal(canRestoreReviewedRetry(retry, "owner-a", "owner-a"), true);
  assert.equal(canRestoreReviewedRetry(retry, "owner-a", "owner-b"), false);
  assert.equal(canRestoreReviewedRetry(retry, undefined, "owner-a"), false);
  assert.match(backgroundSource, /STORAGE_KEYS\.captureOperationOwners/);
  assert.match(
    backgroundSource,
    /captureOperationOwnerIds\.set\([\s\S]*persistedOwnerId as string/,
  );
  assert.match(
    contentSource,
    /EXPORT_CAPTURE_OPERATION_PAYLOAD[\s\S]*exportCaptureOperationPayload/,
  );
  assert.match(
    contentSource,
    /The reviewed capture is no longer available in this tab\. Recapture before exporting\./,
  );
  assert.match(
    backgroundSource,
    /GET_CAPTURE_OPERATION_PAYLOAD[\s\S]*The reviewed capture is no longer available in this tab/,
  );
});

test("exports the exact reviewed in-tab payload without a raw background queue", () => {
  assert.match(contentSource, /JSON\.stringify\(operation\.payload, null, 2\)/);
  assert.match(contentSource, /URL\.createObjectURL\(blob\)/);
  assert.match(
    contentSource,
    /operation\.chatIdentity !== getCurrentChatIdentity\(\)/,
  );
  assert.doesNotMatch(
    backgroundSource,
    /queuePendingUpload|retryPendingUploads/,
  );
  assert.ok(!manifest.permissions.includes("downloads"));
});

test("shows results, last capture, remembered mode, and exactly two planned actions", () => {
  for (const source of [popupSource, contentSource]) {
    assert.match(source, /Existing conversation found — no duplicate created/);
    assert.match(source, /New conversation received/);
    assert.match(source, /Last capture:/);
    assert.match(source, /SET_PREFERRED_CAPTURE_MODE/);
  }
  assert.match(popupSource, /GET_CAPTURE_OPERATIONAL_STATE/);
  assert.match(
    popupSource,
    /showLoggedIn\(result\.data\?\.user\);\s*await refreshOperationalState\(\)/,
  );
  assert.match(contentSource, /GET_CAPTURE_OPERATIONAL_STATE/);
  assert.equal((popupHtml.match(/— <b>Soon<\/b>/g) || []).length, 2);
  assert.equal((contentSource.match(/— <b>Soon<\/b>/g) || []).length, 2);
});

test("removes closed-tab captures without leaving permanent badge attention", () => {
  assert.equal(deriveToolbarBadge([operation("cancelled")], 0).text, "");
  assert.match(
    backgroundSource,
    /handleCaptureTabRemoved[\s\S]*captureOperations\.delete\(tabId\)[\s\S]*captureOperationOwnerIds\.delete\(operation\.operationId\)/,
  );
});
