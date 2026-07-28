import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getLauncherTop,
  normalizeLauncherPosition,
  resolveLauncherEdge,
  resolveLauncherPreset,
} from "../src/launcher-position";

const contentSource = await readFile(
  new URL("../src/content.ts", import.meta.url),
  "utf8",
);
const styles = await readFile(
  new URL("../src/content.css", import.meta.url),
  "utf8",
);
const backgroundSource = await readFile(
  new URL("../src/background.ts", import.meta.url),
  "utf8",
);
const optionsSource = await readFile(
  new URL("../options/options.js", import.meta.url),
  "utf8",
);

test("normalizes persisted launcher placement without trusting arbitrary data", () => {
  assert.deepEqual(normalizeLauncherPosition(null), {
    edge: "right",
    preset: "middle",
  });
  assert.deepEqual(
    normalizeLauncherPosition({ edge: "left", preset: "lower" }),
    { edge: "left", preset: "lower" },
  );
  assert.deepEqual(
    normalizeLauncherPosition({ edge: "center", preset: "anywhere" }),
    { edge: "right", preset: "middle" },
  );
});

test("keeps all three presets inside the viewport and above the composer", () => {
  const upper = getLauncherTop("upper", 900);
  const middle = getLauncherTop("middle", 900);
  const lower = getLauncherTop("lower", 900);
  assert.ok(upper < middle);
  assert.ok(middle < lower);
  assert.ok(lower + 44 <= 900 - 104);
  assert.ok(getLauncherTop("lower", 120) >= 12);
  assert.ok(getLauncherTop("lower", 120) + 44 <= 120 - 12);
});

test("snaps pointer placement to an edge and vertical preset", () => {
  assert.equal(resolveLauncherEdge(100, 1000), "left");
  assert.equal(resolveLauncherEdge(900, 1000), "right");
  assert.equal(resolveLauncherPreset(100, 900), "upper");
  assert.equal(resolveLauncherPreset(450, 900), "middle");
  assert.equal(resolveLauncherPreset(800, 900), "lower");
});

test("renders a compact inward-opening launcher with explicit position controls", () => {
  assert.match(contentSource, /id="ws-launcher-toggle"/);
  assert.match(contentSource, /id="ws-launcher-panel"/);
  assert.match(contentSource, /data-launcher-preset="upper"/);
  assert.match(contentSource, /data-launcher-preset="middle"/);
  assert.match(contentSource, /data-launcher-preset="lower"/);
  assert.match(contentSource, /setPointerCapture/);
  assert.match(contentSource, /resolveLauncherEdge/);
  assert.match(contentSource, /resolveLauncherPreset/);
  assert.match(contentSource, /STORAGE_KEYS\.launcherPosition/);
  assert.match(styles, /width: 44px/);
  assert.match(
    styles,
    /\.ws-edge-left \.ws-launcher-panel \{[\s\S]*left: calc\(100% \+ 10px\)/,
  );
  assert.match(
    styles,
    /\.ws-edge-right \.ws-launcher-panel \{[\s\S]*right: calc\(100% \+ 10px\)/,
  );
  assert.match(styles, /position: absolute/);
  assert.match(styles, /data-preset="lower"[\s\S]*bottom: 0/);
});

test("keeps operation, migration, and accessibility state inside the panel", () => {
  assert.match(contentSource, /id="ws-launcher-badge"/);
  assert.match(contentSource, /ready-for-review/);
  assert.match(contentSource, /retry-required/);
  assert.match(contentSource, /Legacy local captures need review/);
  assert.match(contentSource, /Export or confirmed deletion only/);
  assert.match(contentSource, /aria-live="polite"/);
  assert.match(contentSource, /aria-expanded="false"/);
  assert.match(contentSource, /event\.key === "Escape"/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /forced-colors: active/);
  assert.match(styles, /max-width: 420px/);
});

test("gets only a safe legacy count from the background", () => {
  const injection = contentSource.slice(
    contentSource.indexOf("async function injectUI"),
    contentSource.indexOf("function setupLauncherInteraction"),
  );
  const authenticationRefresh = contentSource.slice(
    contentSource.indexOf("async function refreshLauncherAuthenticationState"),
    contentSource.indexOf("function updateStatus"),
  );
  assert.doesNotMatch(injection, /STORAGE_KEYS\.authToken/);
  assert.match(authenticationRefresh, /GET_LEGACY_QUEUE_SUMMARY/);
  assert.doesNotMatch(injection, /STORAGE_KEYS\.pendingUploads/);
  assert.doesNotMatch(contentSource, /chrome\.storage\.onChanged/);
  assert.match(backgroundSource, /async function getLegacyQueueSummary/);
  assert.match(backgroundSource, /typeof authenticatedOwnerId === "string"/);
  assert.match(backgroundSource, /Array\.isArray\(pending\)/);
});

test("refreshes account-scoped launcher state on authentication messages", () => {
  assert.match(
    contentSource,
    /function normalizeAuthToken[\s\S]*typeof value === "string" && value\.trim\(\)\.length > 0/,
  );
  assert.match(
    contentSource,
    /async function refreshLauncherFromValidatedAuthentication[\s\S]*GET_AUTH_STATUS[\s\S]*isAuthenticated[\s\S]*normalizeAuthToken/,
  );
  assert.match(
    contentSource,
    /await refreshLauncherFromValidatedAuthentication\(\)\.catch\(\(\) => undefined\)/,
  );
  assert.match(
    contentSource,
    /async function refreshLauncherAuthenticationState/,
  );
  assert.match(
    contentSource,
    /resetLauncherAccountState\(token !== null\)[\s\S]*if \(token === null\) return/,
  );
  assert.match(
    contentSource,
    /GET_CAPTURE_OPERATION[\s\S]*GET_LEGACY_QUEUE_SUMMARY/,
  );
  assert.match(
    contentSource,
    /const refreshGeneration = \+\+launcherAuthRefreshGeneration/,
  );
  assert.match(
    contentSource,
    /catch \(error\) \{\s*if \(refreshGeneration !== launcherAuthRefreshGeneration\) return;\s*resetLauncherAccountState\(token !== null\)/,
  );
  assert.match(
    contentSource,
    /case "SET_AUTH_TOKEN"[\s\S]*authToken = normalizeAuthToken\(typedMessage\.token\)[\s\S]*refreshLauncherAuthenticationState\(authToken\)/,
  );
  assert.match(contentSource, /launcherOperation = null/);
});

test("moves focus into the panel and clears cancelled-drag suppression", () => {
  assert.match(
    contentSource,
    /if \(expanded\) \{\s*panel\.querySelector<HTMLButtonElement>\("button:not\(\[disabled\]\)"\)\?\.focus\(\)/,
  );
  assert.match(contentSource, /pointercancel[\s\S]*finishDrag\(event, true\)/);
  assert.match(
    contentSource,
    /if \(cancelled\) \{\s*drag = undefined;\s*launcherSuppressClick = false;\s*applyLauncherPosition\(\);\s*return;/,
  );
});

test("revalidates authentication and safe legacy state after options changes", () => {
  assert.match(
    backgroundSource,
    /case "REFRESH_LAUNCHER_STATE"[\s\S]*notifyLauncherStateRefresh/,
  );
  assert.match(
    backgroundSource,
    /const syncResponse = await syncMystiraSession\(\)[\s\S]*if \(!syncResponse\.success\)[\s\S]*isAuthenticated: false/,
  );
  assert.match(
    optionsSource,
    /remove\(STORAGE_KEYS\.pendingUploads\)[\s\S]*notifyLauncherStateRefresh\(\)/,
  );
  assert.match(
    optionsSource,
    /chrome\.storage\.local\.clear\(\)[\s\S]*notifyLauncherStateRefresh\(\)/,
  );
  assert.doesNotMatch(contentSource, /chrome\.storage\.onChanged/);
});
