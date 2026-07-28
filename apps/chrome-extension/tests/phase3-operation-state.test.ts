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
  assert.match(
    backgroundSource,
    /await clearCaptureStateAndAuthentication\(true\)/,
  );
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

test("allows an explicit page click to continue a popup-started review", () => {
  const clickHandler = contentSource.slice(
    contentSource.indexOf("async function handleExtractClick"),
    contentSource.indexOf("async function reviewPageCapture"),
  );
  assert.match(
    clickHandler,
    /\["ready-for-review", "retry-required"\]\.includes\(response\.data\.state\)/,
  );
  assert.doesNotMatch(clickHandler, /response\.data\.initiator/);
  assert.match(clickHandler, /await reviewPageCapture\(response\.data\)/);
});

test("invalidates collection and upload continuations across auth changes", () => {
  assert.match(backgroundSource, /let captureLifecycleEpoch = 0/);
  assert.match(
    backgroundSource,
    /const operationEpoch = captureLifecycleEpoch/,
  );
  assert.match(
    backgroundSource,
    /isCurrentCaptureOperation\(operation, operationEpoch\)/,
  );
  assert.match(backgroundSource, /clearCaptureStateAndAuthentication\(false\)/);
  assert.match(backgroundSource, /captureOperationEpochs\.clear\(\)/);
  assert.match(backgroundSource, /captureAuthTransitionCount > 0/);
});

test("counts repeated terminal renders only once", () => {
  assert.match(contentSource, /lastCountedTerminalOperationId/);
  assert.match(
    contentSource,
    /lastCountedTerminalOperationId !== operation\.operationId/,
  );
});

test("binds retained reviews to their authenticated owner", () => {
  assert.match(backgroundSource, /captureOperationOwnerIds/);
  assert.match(backgroundSource, /boundOwnerId/);
  assert.match(backgroundSource, /refreshedOwnerId !== expectedOwnerId/);
  assert.match(backgroundSource, /clearCaptureStateForAccountChange\(\)/);
});

test("requires an authenticated owner before retaining a capture", () => {
  const startBlock = backgroundSource.slice(
    backgroundSource.indexOf("async function startCaptureOperation"),
    backgroundSource.indexOf("async function confirmCaptureOperation"),
  );
  assert.match(startBlock, /typeof authenticatedOwnerId !== "string"/);
  assert.match(
    startBlock,
    /captureOperationOwnerIds\.set\(operation\.operationId, authenticatedOwnerId\)/,
  );
  assert.match(
    backgroundSource,
    /typeof boundOwnerId !== "string"[\s\S]*currentOwnerId !== boundOwnerId/,
  );
  assert.doesNotMatch(
    backgroundSource,
    /expectedOwnerId &&[\s\S]{0,120}(refreshedOwnerId|finalOwnerId)/,
  );
});

test("revalidates the owner with the exact upload credential", () => {
  assert.match(backgroundSource, /const finalCredentialState = await/);
  assert.match(backgroundSource, /finalOwnerId !== expectedOwnerId/);
  assert.match(
    backgroundSource,
    /Authorization: `Bearer \$\{finalAuthToken\}`/,
  );
  assert.ok(
    backgroundSource.indexOf("const finalCredentialState = await") <
      backgroundSource.indexOf("Authorization: `Bearer ${finalAuthToken}`"),
  );
});

test("invalidates retained reviews when authentication writes change owner", () => {
  assert.match(backgroundSource, /authenticationWriteTail/);
  assert.match(backgroundSource, /async function replaceAuthenticatedUser/);
  assert.match(backgroundSource, /nextOwnerId !== previousOwnerId/);
  assert.match(backgroundSource, /await invalidateLoadedCaptureOperations\(\)/);
  assert.match(
    backgroundSource,
    /await replaceAuthenticatedUser\(\s*exchanged\.token/,
  );
  assert.match(
    backgroundSource,
    /await replaceAuthenticatedUser\(token, user\)/,
  );
});

test("keeps in-flight upload truth across logout and tab closure", () => {
  const logoutCleanup = backgroundSource.slice(
    backgroundSource.indexOf(
      "async function clearCaptureStateAndAuthentication",
    ),
    backgroundSource.indexOf(
      "async function clearCaptureStateForAccountChange",
    ),
  );
  assert.ok(
    logoutCleanup.indexOf("Promise.allSettled") <
      logoutCleanup.indexOf("invalidateLoadedCaptureOperations"),
  );
  const tabRemoval = backgroundSource.slice(
    backgroundSource.indexOf("chrome.tabs.onRemoved.addListener"),
    backgroundSource.indexOf("// Message Handler"),
  );
  assert.doesNotMatch(tabRemoval, /isActiveCaptureState/);
  assert.doesNotMatch(tabRemoval, /"uploading"/);
});

test("rejects late collection responses after background cancellation", () => {
  assert.match(
    backgroundSource,
    /isCurrentCaptureOperation\(operation, operationEpoch, "collecting"\)/,
  );
  assert.match(backgroundSource, /currentOperation\.state === expectedState/);
});

test("keeps stale content collection cleanup scoped to its operation", () => {
  assert.match(
    contentSource,
    /activeCaptureOperation\?\.operationId === operationId/,
  );
  assert.match(
    contentSource,
    /activeCaptureOperation\.operationId === operationId\s*\) \{\s*state\.isExtracting = false/,
  );
});

test("validates the selected chat before publishing a retry", () => {
  assert.match(backgroundSource, /VALIDATE_CAPTURE_OPERATION_CONTEXT/);
  assert.match(
    backgroundSource,
    /!contextResponse\.success \|\| !contextResponse\.data\?\.isCurrent/,
  );
  assert.match(
    contentSource,
    /activeCaptureOperation\.chatIdentity === getCurrentChatIdentity\(\)/,
  );
});

test("notifies the tab when restart restoration cancels an operation", () => {
  const restoreBlock = backgroundSource.slice(
    backgroundSource.indexOf("for (const operation of interrupted)"),
    backgroundSource.indexOf("async function persistCaptureOperations"),
  );
  assert.match(restoreBlock, /chrome\.tabs/);
  assert.match(restoreBlock, /CAPTURE_OPERATION_UPDATED/);
  assert.ok(
    restoreBlock.indexOf("CAPTURE_OPERATION_UPDATED") <
      restoreBlock.indexOf("discardCapturePayload"),
  );
});
