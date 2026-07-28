import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const backgroundSource = read("../src/background.ts");
const contentSource = read("../src/content.ts");
const popupSource = read("../popup/popup.js");
const popupHtml = read("../popup/popup.html");
const optionsSource = read("../options/options.js");
const optionsHtml = read("../options/options.html");
const manifest = JSON.parse(read("../manifest.json"));

test("requires loaded-message review and confirmation in both upload surfaces", () => {
  assert.match(popupHtml, /Loaded-message review/);
  assert.match(popupHtml, /Only messages currently loaded by WhatsApp/);
  assert.match(popupHtml, /id="confirmCapture"/);
  assert.match(popupSource, /confirmCapture\.addEventListener\("click"/);
  assert.match(contentSource, /const confirmed = window\.confirm/);
  assert.match(
    contentSource,
    /Older messages that WhatsApp has not loaded are excluded/,
  );
});

test("keeps popup extraction page-UI-silent and resets terminal progress", () => {
  assert.match(
    contentSource,
    /extractCurrentChatWithRetry\(EXTRACTION_CONFIG\.retryAttempts, true\)/,
  );
  assert.match(contentSource, /if \(!silent && i % 10 === 0\)/);
  assert.match(
    contentSource,
    /finally \{\s+state\.isExtracting = false;\s+updateProgress\(0\);/,
  );
});

test("does not persist or automatically transmit new or legacy raw captures", () => {
  assert.doesNotMatch(backgroundSource, /function queuePendingUpload/);
  assert.doesNotMatch(backgroundSource, /function retryPendingUploads/);
  assert.doesNotMatch(backgroundSource, /RETRY_PENDING_UPLOADS/);
  assert.doesNotMatch(backgroundSource, /chrome\.alarms/);
  assert.doesNotMatch(backgroundSource, /addEventListener\("online"/);
  assert.match(backgroundSource, /code: "retry-required"/);
  assert.ok(!manifest.permissions.includes("alarms"));
});

test("offers export or confirmed deletion for unowned legacy entries", () => {
  assert.match(optionsHtml, /Export Local Queue/);
  assert.match(optionsHtml, /Delete Local Queue/);
  assert.match(
    optionsHtml,
    /never\s+upload those entries\s+under the current account/,
  );
  assert.match(optionsSource, /URL\.createObjectURL\(blob\)/);
  assert.match(optionsSource, /confirm\(/);
  assert.match(
    optionsSource,
    /chrome\.storage\.local\.remove\(STORAGE_KEYS\.pendingUploads\)/,
  );
  assert.doesNotMatch(optionsSource, /RETRY_PENDING_UPLOADS/);
});

test("classifies popup and service-worker channel teardown", () => {
  assert.match(popupSource, /message port closed/);
  assert.match(popupSource, /context invalidated/);
  assert.match(backgroundSource, /function respondSafely/);
  assert.match(contentSource, /function respondSafely/);
});

test("snapshots a confirmed capture until its upload settles", () => {
  assert.match(popupSource, /const captureToSend = pendingCapture/);
  assert.match(popupSource, /data: captureToSend/);
  assert.match(popupSource, /extractBtn\.disabled = true/);
  assert.match(popupSource, /logoutBtn\.disabled = true/);
  assert.match(popupSource, /pendingCapture === captureToSend/);
});

test("classifies upstream HTTP 429 as retry-required", () => {
  assert.match(backgroundSource, /class HttpRequestError extends Error/);
  assert.match(backgroundSource, /isRateLimitError\(error\)/);
  assert.match(backgroundSource, /error\.status === 429/);
  assert.match(backgroundSource, /retryRequired: true/);
});
