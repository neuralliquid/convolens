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

test("keeps the background as owner of guided progress and finalization", () => {
  assert.match(captureSource, /CaptureOperationMode = "loaded" \| "guided"/);
  assert.match(backgroundSource, /case "UPDATE_GUIDED_CAPTURE_OPERATION"/);
  assert.match(backgroundSource, /case "STOP_GUIDED_CAPTURE_OPERATION"/);
  assert.match(
    backgroundSource,
    /state: operation\.mode === "guided" \? "collecting"/,
  );
  assert.match(backgroundSource, /action: "FINALIZE_GUIDED_CAPTURE_OPERATION"/);
  assert.match(backgroundSource, /state: "ready-for-review"/);
});

test("preserves a concurrently finalized review before guided activation", () => {
  assert.match(
    backgroundSource,
    /const currentBeforeActivation = captureOperations\.get\(tabId\)[\s\S]*!isCurrentCaptureOperation\(operation, operationEpoch, "collecting"\)[\s\S]*return \{ success: true, data: currentBeforeActivation \}/,
  );
  assert.match(
    backgroundSource,
    /if \(!activation\.success\)[\s\S]*currentAfterActivation\.state !== "collecting"[\s\S]*return \{ success: true, data: currentAfterActivation \}/,
  );
  assert.match(
    backgroundSource,
    /catch \(error\)[\s\S]*const concurrentResult = captureOperations\.get\(tabId\)[\s\S]*return \{ success: true, data: concurrentResult \}/,
  );
});

test("offers start, running count, stop-and-review, and cancel on both surfaces", () => {
  for (const surface of [popupHtml, contentSource]) {
    assert.match(surface, /Capture as I scroll/);
    assert.match(surface, /Available/);
    assert.match(surface, /Stop and review/);
    assert.match(surface, /Guided capture is active/);
  }
  assert.match(popupSource, /mode === "guided" \? "Start guided capture"/);
  assert.match(popupSource, /action: "STOP_GUIDED_CAPTURE_OPERATION"/);
  assert.match(contentSource, /selectedPageCaptureMode/);
  assert.match(contentSource, /stopPageGuidedCapture/);
});

test("preserves the requested mode after popup cancellation renders", () => {
  assert.match(popupSource, /captureModeChangeGeneration/);
  assert.match(
    popupSource,
    /\[\s*"inspecting",\s*"collecting",\s*"ready-for-review",\s*"retry-required",?\s*\]/,
  );
  assert.match(
    popupSource,
    /discardUnconfirmedCaptureForModeChange\(selectedMode\)[\s\S]*\.finally\(\(\) => \{[\s\S]*applyPopupCaptureMode\(selectedMode\)/,
  );
});

test("preserves the requested mode after launcher cancellation renders", () => {
  assert.match(contentSource, /launcherModeChangeGeneration/);
  assert.match(
    contentSource,
    /\[\s*"inspecting",\s*"collecting",\s*"ready-for-review",\s*"retry-required",?\s*\]/,
  );
  assert.match(
    contentSource,
    /function applyPageCaptureMode[\s\S]*if \(input\) input\.checked = selected/,
  );
  assert.match(
    contentSource,
    /reviewPageCapture\(launcherOperation, false\)[\s\S]*\.finally\(\(\) => \{[\s\S]*applyPageCaptureMode\(selectedMode\)/,
  );
  assert.match(
    contentSource,
    /pageConfirmationOperationId === operation\.operationId[\s\S]*if \(pageConfirmationPromise\) await pageConfirmationPromise/,
  );
});

test("observes user scrolling without programmatically taking scroll control", () => {
  assert.match(contentSource, /new MutationObserver\(queueGuidedWindowRead\)/);
  assert.match(
    contentSource,
    /addEventListener\("scroll", queueGuidedWindowRead/,
  );
  assert.doesNotMatch(contentSource, /scrollTop\s*=/);
  assert.doesNotMatch(contentSource, /scrollTo\(/);
});

test("snapshots every observed virtualized window before serial merging", () => {
  assert.match(
    contentSource,
    /pendingWindows\.push\(extractCurrentChat\(true\)\.catch\(\(\) => null\)\)/,
  );
  assert.match(contentSource, /pendingWindows\.shift\(\)/);
  assert.doesNotMatch(contentSource, /debounceId/);
  assert.doesNotMatch(contentSource, /pendingRead/);
});

test("does not assume a zero-overlap window belongs at the older edge", () => {
  assert.match(contentSource, /resolveDisjointGuidedEdge/);
  assert.match(contentSource, /mergeEdge === null[\s\S]*ambiguous: true/);
  assert.match(
    contentSource,
    /captureTimestampMethod === "metadata"[\s\S]*\? \[item\.value\.timestamp\][\s\S]*: \[\]/,
  );
});

test("does not order disjoint windows from date-less visible times", () => {
  const edgeResolver = contentSource.slice(
    contentSource.indexOf("function guidedMergeEdge"),
    contentSource.indexOf("function summarizeCapturePayload"),
  );
  assert.doesNotMatch(
    edgeResolver,
    /captureTimestampMethod === "visible-time"/,
  );
  assert.doesNotMatch(edgeResolver, /captureTimestampMethod === "fallback"/);
});

test("stops observing and drains queued windows before final review", () => {
  assert.match(
    contentSource,
    /pauseGuidedCaptureSession\(session\);[\s\S]*if \(session\.drainPromise\) await session\.drainPromise;[\s\S]*summarizeCapturePayload/,
  );
  assert.match(contentSource, /session\.drainPromise = drain/);
});

test("normalizes generated timestamps out of fallback alignment", () => {
  assert.match(
    contentSource,
    /timestamp:[\s\S]*timestamp\.method === "fallback" \? "unavailable" : timestamp\.value/,
  );
});

test("bounds guided capture and records explicit stop reasons", () => {
  assert.match(contentSource, /GUIDED_CAPTURE_LIMIT = 2_000/);
  assert.match(contentSource, /GUIDED_CAPTURE_TIMEOUT_MS = 10 \* 60 \* 1_000/);
  assert.match(contentSource, /consecutiveFailures >= 3/);
  for (const reason of [
    "guided-user-stopped",
    "guided-safety-limit",
    "guided-timeout",
    "guided-dom-failure",
  ]) {
    assert.match(
      captureSource + backgroundSource + contentSource,
      new RegExp(reason),
    );
  }
  assert.match(contentSource, /The selected chat changed\. Nothing was sent\./);
});

test("uses raw source IDs only as non-enumerable in-tab alignment evidence", () => {
  assert.match(contentSource, /messageRecord\.getAttribute\("data-id"\)/);
  assert.match(contentSource, /captureSourceId:[\s\S]*enumerable: false/);
  assert.match(contentSource, /captureAlignmentToken:[\s\S]*enumerable: false/);
  assert.match(contentSource, /captureMetadataPath:[\s\S]*enumerable: false/);
  assert.match(contentSource, /captureSenderMethod:[\s\S]*enumerable: false/);
  assert.match(
    contentSource,
    /captureTimestampMethod:[\s\S]*enumerable: false/,
  );
  assert.doesNotMatch(captureSource, /captureSourceId/);
  assert.doesNotMatch(captureSource, /captureTimestampMethod/);
  assert.doesNotMatch(captureSource, /captureMetadataPath/);
  assert.doesNotMatch(captureSource, /captureSenderMethod/);
  assert.doesNotMatch(backgroundSource, /captureSourceId/);
  assert.doesNotMatch(backgroundSource, /captureTimestampMethod/);
  assert.doesNotMatch(backgroundSource, /captureMetadataPath/);
  assert.doesNotMatch(backgroundSource, /captureSenderMethod/);
});

test("rebuilds diagnostic method counts from the retained guided buffer", () => {
  assert.match(contentSource, /function summarizeGuidedDiagnosticMethods/);
  assert.match(
    contentSource,
    /for \(const message of messages\)[\s\S]*metadataPathCounts\[message\.captureMetadataPath\] \+= 1[\s\S]*senderMethodCounts\[message\.captureSenderMethod\] \+= 1[\s\S]*timestampMethodCounts\[message\.captureTimestampMethod\] \+= 1/,
  );
  assert.match(
    contentSource,
    /const diagnosticMethods = summarizeGuidedDiagnosticMethods\([\s\S]*session\.payload\.messages[\s\S]*\.\.\.diagnosticMethods/,
  );
});

test("commits only participant identities referenced by the bounded merge", () => {
  assert.match(
    contentSource,
    /const candidateParticipants = \[\.\.\.session\.payload\.participants\]/,
  );
  assert.match(contentSource, /const retainedParticipantRefs = new Set/);
  assert.match(
    contentSource,
    /session\.payload\.participants = candidateParticipants\.filter[\s\S]*retainedParticipantRefs\.has/,
  );
  assert.match(contentSource, /nextParticipantRef\(candidateParticipants\)/);
});
