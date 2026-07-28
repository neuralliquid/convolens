import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const captureSource = read("../src/capture-operation.ts");
const contentSource = read("../src/content.ts");
const popupHtml = read("../popup/popup.html");
const popupSource = read("../popup/popup.js");

test("renders an ephemeral exact-count preview in both capture surfaces", () => {
  for (const label of [
    "Loaded messages",
    "Participant labels",
    "Media",
    "Skipped",
    "Unreadable",
  ]) {
    assert.match(popupHtml, new RegExp(label));
    assert.match(contentSource, new RegExp(label));
  }
  assert.match(contentSource, /chatName: payload\.chatName/);
  assert.match(contentSource, /oldestTimestamp: timestamps\[0\]/);
  assert.match(
    contentSource,
    /newestTimestamp: timestamps\[timestamps\.length - 1\]/,
  );
  assert.match(contentSource, /GET_CAPTURE_PREVIEW/);
  assert.match(popupSource, /action: "GET_CAPTURE_PREVIEW"/);
  assert.match(
    popupSource,
    /preview\.loadedMessageCount !== operation\.extractedCount[\s\S]*confirmCapture\.disabled = true/,
  );
  assert.match(
    contentSource,
    /preview\.loadedMessageCount !== operation\.extractedCount/,
  );
});

test("enables guided capture while keeping automatic mode disabled", () => {
  for (const surface of [popupHtml, contentSource]) {
    assert.match(surface, /Capture as I scroll/);
    assert.match(surface, /Available/);
    assert.match(surface, /Load older messages for me/);
    assert.match(surface, /Soon · Phase 7/);
    assert.match(surface, /value="automatic"[\s\S]{0,40}disabled/);
  }
  assert.match(popupHtml, /value="loaded"[\s\S]{0,40}checked/);
  assert.match(contentSource, /value="loaded"[\s\S]{0,40}checked/);
});

test("uses explicit confirm and cancel without persisting the chat name", () => {
  assert.match(popupSource, /confirmCapture\.addEventListener\("click"/);
  assert.match(popupSource, /cancelCapture\.addEventListener\("click"/);
  assert.match(contentSource, /reviewPageCapture\(launcherOperation, true\)/);
  assert.match(contentSource, /reviewPageCapture\(launcherOperation, false\)/);
  assert.doesNotMatch(contentSource, /window\.confirm/);
  assert.doesNotMatch(captureSource, /chatName/);
  assert.match(
    popupSource,
    /discardUnconfirmedCaptureForModeChange[\s\S]*CANCEL_CAPTURE_OPERATION/,
  );
  assert.match(
    contentSource,
    /handleCaptureModeChange[\s\S]*reviewPageCapture\(launcherOperation, false\)/,
  );
});

test("separates unreadable records from skipped containers", () => {
  assert.match(contentSource, /unreadableMessageCount \+= 1/);
  assert.match(
    contentSource,
    /messageContainerCount -[\s\S]*messages\.length -[\s\S]*unreadableMessageCount/,
  );
  assert.match(captureSource, /unreadableCount: number/);
  assert.match(captureSource, /participantLabelCount: number/);
});
