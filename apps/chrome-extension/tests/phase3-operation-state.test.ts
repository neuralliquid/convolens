import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  completeCaptureOperation,
  createCaptureOperation,
  isActiveCaptureState,
  isTerminalCaptureState,
  sanitizeOperationReason,
} from "../src/capture-operation";

const backgroundSource = await readFile(
  new URL("../src/background.ts", import.meta.url),
  "utf8",
);
const contentSource = await readFile(
  new URL("../src/content.ts", import.meta.url),
  "utf8",
);
const popupSource = await readFile(
  new URL("../popup/popup.js", import.meta.url),
  "utf8",
);

test("models active and terminal capture operation states", () => {
  const started = createCaptureOperation(
    42,
    "popup",
    new Date("2026-07-28T12:00:00.000Z"),
  );
  assert.equal(started.tabId, 42);
  assert.equal(started.state, "inspecting");
  assert.equal(isActiveCaptureState(started.state), true);

  const cancelled = completeCaptureOperation(
    started,
    "cancelled",
    "tab changed",
    new Date("2026-07-28T12:01:00.000Z"),
  );
  assert.equal(isTerminalCaptureState(cancelled.state), true);
  assert.equal(isActiveCaptureState(cancelled.state), false);
  assert.equal(cancelled.completedAt, "2026-07-28T12:01:00.000Z");
});

test("keeps lifecycle reasons bounded and single-line", () => {
  const reason = sanitizeOperationReason(`channel closed\n${"x".repeat(300)}`);
  assert.equal(reason.includes("\n"), false);
  assert.equal(reason.length, 240);
});

test("routes popup and page through one background-owned per-tab operation", () => {
  assert.match(backgroundSource, /Map<number, CaptureOperationSnapshot>/);
  assert.match(backgroundSource, /case "START_CAPTURE_OPERATION"/);
  assert.match(backgroundSource, /captureOperations\.get\(tabId\)/);
  assert.match(backgroundSource, /isActiveCaptureState\(existing\.state\)/);
  assert.match(popupSource, /START_CAPTURE_OPERATION/);
  assert.match(contentSource, /START_CAPTURE_OPERATION/);
  assert.doesNotMatch(popupSource, /GET_CURRENT_CHAT/);
  assert.doesNotMatch(popupSource, /SEND_CHAT_DATA/);
});

test("persists only operation snapshots and keeps raw capture in tab memory", () => {
  const persistenceFunction = backgroundSource.slice(
    backgroundSource.indexOf("async function persistCaptureOperations"),
    backgroundSource.indexOf("async function publishCaptureOperation"),
  );
  assert.match(persistenceFunction, /chrome\.storage\.session\.set/);
  assert.match(persistenceFunction, /Object\.fromEntries\(captureOperations\)/);
  assert.match(contentSource, /payload: ExtractedChat \| null/);
  assert.match(contentSource, /activeCaptureOperation/);
  assert.match(contentSource, /getOpaqueChatKey/);
  assert.match(backgroundSource, /chatKey: summary\.chatKey/);
  assert.doesNotMatch(persistenceFunction, /storage\.local/);
});

test("serializes upload, restores popup state, and classifies lifecycle teardown", () => {
  assert.match(backgroundSource, /captureUploadPromises\.set/);
  assert.match(backgroundSource, /GET_CAPTURE_OPERATION_PAYLOAD/);
  assert.match(backgroundSource, /The extension background restarted/);
  assert.match(backgroundSource, /chrome\.tabs\.onRemoved\.addListener/);
  assert.match(popupSource, /GET_CAPTURE_OPERATION/);
  assert.match(popupSource, /CAPTURE_OPERATION_UPDATED/);
  assert.match(contentSource, /The selected chat changed\. Nothing was sent/);
  assert.match(contentSource, /operation\.state !== "uploading"/);
});

test("clears reviewed payloads before authentication changes account", () => {
  assert.match(backgroundSource, /await clearCaptureOperationsForLogout\(\)/);
  assert.match(
    backgroundSource,
    /await Promise\.allSettled\(\[\.\.\.captureUploadPromises\.values\(\)\]\)/,
  );
  assert.match(backgroundSource, /captureOperations\.clear\(\)/);
  assert.match(backgroundSource, /await discardCapturePayload\(operation\)/);
});

test("allows a page-owned retry-required operation to confirm again", () => {
  assert.match(
    contentSource,
    /\["ready-for-review", "retry-required"\]\.includes\(response\.data\.state\)/,
  );
  assert.match(
    contentSource,
    /response\.data\.state === "retry-required"[\s\S]*pageConfirmationOperationId = null/,
  );
});
