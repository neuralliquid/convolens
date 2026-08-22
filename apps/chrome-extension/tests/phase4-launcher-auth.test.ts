import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
    /async function refreshLauncherFromValidatedAuthentication[\s\S]*const refreshGeneration = \+\+launcherAuthRefreshGeneration[\s\S]*resetLauncherAccountState\(false\)/,
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
    /refreshLauncherFromValidatedAuthentication[\s\S]*const refreshGeneration = \+\+launcherAuthRefreshGeneration[\s\S]*GET_AUTH_STATUS[\s\S]*if \(refreshGeneration !== launcherAuthRefreshGeneration\) return;[\s\S]*chrome\.storage\.local\.get[\s\S]*if \(refreshGeneration !== launcherAuthRefreshGeneration\) return;[\s\S]*refreshLauncherAuthenticationState/,
  );
  assert.match(
    contentSource,
    /const operationRenderGeneration = launcherOperationRenderGeneration[\s\S]*operationRenderGeneration === launcherOperationRenderGeneration[\s\S]*renderCaptureOperation\(operationResponse\.data\)/,
  );
  assert.match(
    contentSource,
    /function renderCaptureOperation[\s\S]*launcherOperationRenderGeneration \+= 1/,
  );
  assert.match(
    contentSource,
    /catch \(error\) \{\s*if \(refreshGeneration !== launcherAuthRefreshGeneration\) return;/,
  );
  assert.match(
    contentSource,
    /catch \(error\)[\s\S]*operationRenderGeneration !== launcherOperationRenderGeneration[\s\S]*resetLauncherAccountState/,
  );
  assert.match(
    contentSource,
    /case "SET_AUTH_TOKEN"[\s\S]*authToken = normalizeAuthToken\(typedMessage\.token\)[\s\S]*refreshLauncherAuthenticationState\(authToken\)/,
  );
  assert.match(contentSource, /launcherOperation = null/);
  assert.match(
    backgroundSource,
    /SET_AUTH_TOKEN[\s\S]*authGeneration: captureLifecycleEpoch/,
  );
  assert.match(
    contentSource,
    /operation\.authGeneration !== launcherCaptureAuthGeneration[\s\S]*return false/,
  );
  assert.match(
    contentSource,
    /launcherCaptureAuthGeneration = typedMessage\.authGeneration/,
  );
  assert.match(
    backgroundSource,
    /async function getAuthStatus[\s\S]*await loadCaptureOperations\(\)[\s\S]*authGeneration: captureLifecycleEpoch/,
  );
  assert.match(
    backgroundSource,
    /syncMystiraSession\(\s*authenticationIntent: number[\s\S]*replaceAuthenticatedUser\([\s\S]*authenticationIntent[\s\S]*if \(!replaced\)/,
  );
  assert.match(
    backgroundSource,
    /clearCaptureStateAndAuthentication[\s\S]*const clearAuthenticationIntent = \+\+authenticationIntentGeneration[\s\S]*Promise\.allSettled\(\[\.\.\.captureUploadPromises\.values\(\)\]\)[\s\S]*const previousWrite = authenticationWriteTail[\s\S]*await previousWrite[\s\S]*committedAuthenticationIntentGeneration > clearAuthenticationIntent[\s\S]*clearAuthenticationState\(\)[\s\S]*releaseWrite\(\)/,
  );
  assert.match(
    backgroundSource,
    /case "SYNC_MYSTIRA_AUTH":[\s\S]*syncMystiraSession\(\+\+authenticationIntentGeneration\)/,
  );
  assert.match(
    backgroundSource,
    /committedAuthenticationIntentGeneration > expectedAuthenticationIntent[\s\S]*activeAuthenticationClearIntents[\s\S]*clearIntent > expectedAuthenticationIntent[\s\S]*return false/,
  );
  assert.match(
    backgroundSource,
    /notifyContentScripts\(token\)[\s\S]*committedAuthenticationIntentGeneration = Math\.max/,
  );
  assert.match(
    backgroundSource,
    /uploadCaptureOperation[\s\S]*const uploadAuthenticationIntent = committedAuthenticationIntentGeneration[\s\S]*sendChatData\([\s\S]*uploadAuthenticationIntent/,
  );
  assert.match(
    backgroundSource,
    /sendChatData\([\s\S]*uploadAuthenticationIntent: number[\s\S]*syncMystiraSession\(uploadAuthenticationIntent\)/,
  );
  assert.match(
    backgroundSource,
    /activeAuthenticationClearIntents\.add\(clearAuthenticationIntent\)[\s\S]*activeAuthenticationClearIntents\.delete\(clearAuthenticationIntent\)/,
  );
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

test("exposes collapsed badge state through the launcher accessible name", () => {
  assert.match(
    contentSource,
    /function updateLauncherBadge[\s\S]*updateLauncherToggleLabel\(\)/,
  );
  assert.match(
    contentSource,
    /getLauncherAccessibleStatus\(\)[\s\S]*loaded message[\s\S]*ready for review/,
  );
  assert.match(contentSource, /Capture needs attention/);
  assert.match(contentSource, /legacy local capture/);
  assert.match(
    contentSource,
    /\["received", "duplicate"\][\s\S]*operation\.reconciliationRequired \|\| legacyQueueCount > 0[\s\S]*value = "!"/,
  );
  assert.match(contentSource, /Reconciliation review required/);
  assert.match(
    contentSource,
    /const terminalAttention =[\s\S]*operation\.reconciliationRequired \|\| legacyQueueCount > 0[\s\S]*\? "attention"/,
  );
});

test("revalidates authentication and safe legacy state after options changes", () => {
  assert.match(
    backgroundSource,
    /case "REFRESH_LAUNCHER_STATE"[\s\S]*notifyLauncherStateRefresh/,
  );
  assert.match(
    backgroundSource,
    /const syncResponse = await syncMystiraSession\([\s\S]*authenticationIntentGeneration[\s\S]*if \(!syncResponse\.success\)[\s\S]*isAuthenticated: false/,
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
