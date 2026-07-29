import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const backgroundSource = read("../src/background.ts");
const captureSource = read("../src/capture-operation.ts");
const contentSource = read("../src/content.ts");
const popupHtml = read("../popup/popup.html");
const popupSource = read("../popup/popup.js");

test("requires explicit consent and exposes bounded automatic choices", () => {
  for (const surface of [popupHtml, contentSource]) {
    assert.match(surface, /last 7 days/i);
    assert.match(surface, /last 30 days/i);
    assert.match(surface, /100 messages/);
    assert.match(surface, /250 messages/);
    assert.match(surface, /500 messages/);
    assert.match(surface, /Verified top of (?:history|conversation)/);
    assert.match(surface, /WhatsApp will scroll/);
  }
  assert.match(popupSource, /automaticConsent\.checked/);
  assert.match(contentSource, /ws-automatic-consent/);
});

test("keeps automatic control background-owned and serializes every command", () => {
  assert.match(backgroundSource, /case "CONTROL_AUTOMATIC_CAPTURE_OPERATION"/);
  assert.match(
    backgroundSource,
    /const previous = automaticControlPromises\.get[\s\S]*previous\.catch[\s\S]*controlAutomaticCaptureOperation/,
  );
  assert.match(
    backgroundSource,
    /command === "pause" \|\| message\.command === "resume"/,
  );
  assert.match(
    contentSource,
    /if \(paused\) \{[\s\S]*session\.observer\.disconnect\(\)[\s\S]*await session\.drainPromise/,
  );
  assert.match(
    contentSource,
    /session\.observer\.observe\(session\.scrollTarget/,
  );
  assert.match(
    contentSource,
    /if \(session\.drainPromise\) await session\.drainPromise;[\s\S]*if \(session\.automaticPaused\) continue/,
  );
  assert.match(
    backgroundSource,
    /action: "FINALIZE_AUTOMATIC_CAPTURE_OPERATION"/,
  );
  assert.match(captureSource, /\| "paused"/);
});

test("supports pause, resume, stop-and-review, and cancel on both surfaces", () => {
  for (const surface of [popupHtml, contentSource]) {
    assert.match(surface, />\s*Pause/);
    assert.match(surface, /Stop and review/);
    assert.match(surface, />Cancel</);
  }
  assert.match(
    popupSource,
    /command: currentOperation\.state === "paused" \? "resume" : "pause"/,
  );
  assert.match(
    contentSource,
    /command: operation\.state === "paused" \? "resume" : "pause"/,
  );
  assert.match(popupSource, /stopReason: "automatic-user-stopped"/);
  assert.match(contentSource, /stopReason: "automatic-user-stopped"/);
});

test("bounds automatic collection and distinguishes truthful completion", () => {
  assert.match(contentSource, /AUTOMATIC_CAPTURE_SAFETY_CAP/);
  assert.match(contentSource, /AUTOMATIC_NO_PROGRESS_LIMIT/);
  assert.match(contentSource, /hasVerifiedTopOfHistory/);
  assert.match(contentSource, /waitForAutomaticStabilization/);
  assert.match(
    contentSource,
    /session\.observedWindowCount > baselineObservedWindowCount/,
  );
  assert.match(
    contentSource,
    /function queueObservedGuidedWindowRead[\s\S]*session\.observedWindowCount \+= 1[\s\S]*queueGuidedWindowRead\(\)/,
  );
  const eagerQueue = contentSource.slice(
    contentSource.indexOf("function queueGuidedWindowRead"),
    contentSource.indexOf("function queueObservedGuidedWindowRead"),
  );
  assert.doesNotMatch(eagerQueue, /observedWindowCount/);
  for (const reason of [
    "automatic-date-boundary",
    "automatic-message-limit",
    "automatic-verified-top",
    "automatic-safety-cap",
    "automatic-no-progress",
    "automatic-dom-failure",
  ]) {
    assert.match(
      captureSource + backgroundSource + contentSource,
      new RegExp(reason),
    );
  }
});

test("restores an approximate anchor and retains raw messages only in tab memory", () => {
  assert.match(contentSource, /originalBottomOffset/);
  assert.match(contentSource, /restoreAutomaticScrollAnchor/);
  assert.match(
    contentSource,
    /getCurrentChatIdentity\(\) !== session\.chatIdentity/,
  );
  assert.match(
    backgroundSource,
    /\[STORAGE_KEYS\.captureOperations\]: Object\.fromEntries\(captureOperations\)/,
  );
  assert.doesNotMatch(captureSource, /messages:/);
});

test("rebuilds trimmed diagnostics from only the retained readable payload", () => {
  assert.match(
    contentSource,
    /function retainAutomaticItems[\s\S]*session\.skippedCount = 0[\s\S]*session\.unreadableCount = 0/,
  );
  assert.match(
    contentSource,
    /messageContainerCount: session\.payload\.messages\.length[\s\S]*unreadableMessageCount: 0/,
  );
});
