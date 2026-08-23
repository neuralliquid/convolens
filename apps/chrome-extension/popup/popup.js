/**
 * ConvoLens Chrome Extension - Popup Script
 */

const DASHBOARD_URL = "https://convolens.neuralliquid.ai";

// DOM Elements
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const loggedOutSection = document.getElementById("loggedOut");
const loggedInSection = document.getElementById("loggedIn");
const loginBtn = document.getElementById("loginBtn");
const loginSpinner = document.getElementById("loginSpinner");
const loginBtnLabel = document.getElementById("loginBtnLabel");
const signupBtn = document.getElementById("signupBtn");
const logoutBtn = document.getElementById("logoutBtn");
const extractBtn = document.getElementById("extractBtn");
const openDashboard = document.getElementById("openDashboard");
const loginError = document.getElementById("loginError");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userAvatar = document.getElementById("userAvatar");
const actionStatus = document.getElementById("actionStatus");
const actionStatusIcon = document.getElementById("actionStatusIcon");
const actionStatusText = document.getElementById("actionStatusText");
const extensionVersion = document.getElementById("extensionVersion");
const dashboardLink = document.getElementById("dashboardLink");
const capturePreview = document.getElementById("capturePreview");
const captureChatName = document.getElementById("captureChatName");
const captureRange = document.getElementById("captureRange");
const previewLoaded = document.getElementById("previewLoaded");
const previewParticipants = document.getElementById("previewParticipants");
const previewMedia = document.getElementById("previewMedia");
const previewSkipped = document.getElementById("previewSkipped");
const previewUnreadable = document.getElementById("previewUnreadable");
const confirmCapture = document.getElementById("confirmCapture");
const cancelCapture = document.getElementById("cancelCapture");
const captureScope = document.getElementById("captureScope");
const previewCountLabel = document.getElementById("previewCountLabel");
const previewWarning = document.getElementById("previewWarning");
const guidedProgress = document.getElementById("guidedProgress");
const guidedCount = document.getElementById("guidedCount");
const guidedOldest = document.getElementById("guidedOldest");
const guidedWarning = document.getElementById("guidedWarning");
const stopGuidedCapture = document.getElementById("stopGuidedCapture");
const cancelGuidedCapture = document.getElementById("cancelGuidedCapture");
const pauseAutomaticCapture = document.getElementById("pauseAutomaticCapture");
const automaticOptions = document.getElementById("automaticOptions");
const automaticBoundary = document.getElementById("automaticBoundary");
const automaticConsent = document.getElementById("automaticConsent");
const collectionProgressTitle = document.getElementById(
  "collectionProgressTitle",
);
const collectionProgressInstruction = document.getElementById(
  "collectionProgressInstruction",
);
const exportCapture = document.getElementById("exportCapture");
const operationalActions = document.getElementById("operationalActions");
const captureResult = document.getElementById("captureResult");
const lastCapture = document.getElementById("lastCapture");
const openConversation = document.getElementById("openConversation");

let currentOperation = null;
let activeWhatsAppTabId = null;
let captureModeChangeGeneration = 0;
let operationalState = { preferredMode: "loaded" };

const PACKAGED_VERSION = "1.0.25";
const runtimeVersion = chrome.runtime.getManifest().version;
if (runtimeVersion === PACKAGED_VERSION) {
  extensionVersion.textContent = `v${runtimeVersion}`;
} else {
  extensionVersion.textContent = `v${runtimeVersion} — reload ${PACKAGED_VERSION}`;
  extensionVersion.title =
    "Chrome is still running an older unpacked copy. Remove it, load the extracted folder, and click Reload.";
}
dashboardLink.href = `${DASHBOARD_URL}/dashboard`;

const ACTION_STATUS_ICONS = {
  info: "ℹ",
  success: "✓",
  error: "⚠",
};

function setActionStatus(message = "", type = "info") {
  actionStatusText.textContent = message;
  actionStatusIcon.textContent = ACTION_STATUS_ICONS[type] || "";
  actionStatus.className = message
    ? `action-status show ${type}`
    : "action-status";
}

function normalizeExtensionError(error) {
  const message =
    typeof error === "string"
      ? error
      : error?.message || "Extension unavailable";

  if (
    /message port closed|receiving end does not exist|context invalidated|tab was closed/i.test(
      message,
    )
  ) {
    return "The extension channel closed. Reopen the popup and review the loaded messages again.";
  }
  if (/failed to fetch|network ?error|load failed/i.test(message)) {
    return "Couldn't reach ConvoLens. Check your internet connection and try again.";
  }
  if (/timed? ?out/i.test(message)) {
    return "ConvoLens took too long to respond. Try again in a moment.";
  }
  if (/^extension unavailable$/i.test(message)) {
    return "The extension isn't responding. Reload the extension from chrome://extensions and try again.";
  }
  return message;
}

async function sendRuntimeMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    const normalized = new Error(normalizeExtensionError(error));
    normalized.code = "channel-closed";
    throw normalized;
  }
}

function openTab(url) {
  chrome.tabs
    .create({ url })
    .catch((error) => setActionStatus(normalizeExtensionError(error), "error"));
}

function clearCapturePreview() {
  captureChatName.textContent = "";
  captureRange.textContent = "";
  for (const field of [
    previewLoaded,
    previewParticipants,
    previewMedia,
    previewSkipped,
    previewUnreadable,
  ]) {
    field.textContent = "0";
  }
  capturePreview.classList.remove("show");
  previewWarning.classList.remove("show");
}

function formatPreviewTimestamp(value) {
  if (!value) return "Not detected";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not detected" : date.toLocaleString();
}

function currentResultPath() {
  if (
    currentOperation &&
    ["received", "duplicate"].includes(currentOperation.state)
  ) {
    return currentOperation.resultPath;
  }
  return operationalState.lastCapture?.resultPath;
}

function renderOperationalActions() {
  operationalActions.hidden = false;
  const terminalOperation =
    currentOperation &&
    ["received", "duplicate"].includes(currentOperation.state)
      ? currentOperation
      : null;
  const resultState =
    terminalOperation?.state || operationalState.lastCapture?.state;
  const reconciliationRequired = terminalOperation
    ? Boolean(terminalOperation.reconciliationRequired)
    : Boolean(operationalState.lastCapture?.reconciliationRequired);
  captureResult.textContent = reconciliationRequired
    ? "New conversation stored separately — reconciliation needed"
    : resultState === "duplicate"
      ? "Existing conversation found — no duplicate created"
      : resultState === "received"
        ? "New conversation received"
        : "No capture result yet";
  const last = operationalState.lastCapture;
  lastCapture.textContent = last
    ? `Last capture: ${last.count} message${last.count === 1 ? "" : "s"} · ${formatPreviewTimestamp(last.completedAt)}`
    : "Last capture: none yet";
  openConversation.hidden = !currentResultPath();
}

function guidedStopReasonLabel(reason) {
  switch (reason) {
    case "guided-safety-limit":
      return "The guided safety limit was reached.";
    case "guided-timeout":
      return "The guided session timed out.";
    case "guided-dom-failure":
      return "Collection stopped after repeated WhatsApp DOM read failures.";
    default:
      return "You stopped collection.";
  }
}

function automaticStopReasonLabel(reason) {
  switch (reason) {
    case "automatic-date-boundary":
      return "The selected date boundary was reached.";
    case "automatic-message-limit":
      return "The selected message limit was reached.";
    case "automatic-verified-top":
      return "WhatsApp exposed a verified top-of-history marker.";
    case "automatic-safety-cap":
      return "The 500-message automatic safety cap was reached.";
    case "automatic-no-progress":
      return "WhatsApp made no further progress; the top was not verified.";
    case "automatic-dom-failure":
      return "Collection stopped after repeated WhatsApp DOM failures.";
    default:
      return "You stopped automatic collection.";
  }
}

function selectedAutomaticBoundary() {
  const value = automaticBoundary.value;
  if (value === "days-7") return { kind: "days", days: 7 };
  if (value === "days-30") return { kind: "days", days: 30 };
  if (value.startsWith("messages-")) {
    return { kind: "messages", messageLimit: Number(value.slice(9)) };
  }
  return { kind: "verified-top" };
}

async function renderCapturePreview(operation) {
  if (!activeWhatsAppTabId) return;
  const operationId = operation.operationId;
  capturePreview.classList.add("show");
  confirmCapture.disabled = true;
  captureChatName.textContent = "Reading preview…";
  const response = await sendToWhatsApp(activeWhatsAppTabId, {
    action: "GET_CAPTURE_PREVIEW",
    operationId,
  });
  if (currentOperation?.operationId !== operationId) return;
  if (!response.success || !response.data) {
    confirmCapture.disabled = true;
    setActionStatus(
      response.error || "The reviewed preview is no longer available.",
      "error",
    );
    return;
  }
  const preview = response.data;
  if (preview.loadedMessageCount !== operation.extractedCount) {
    confirmCapture.disabled = true;
    setActionStatus(
      "The preview no longer matches the reviewed payload. Recapture before uploading.",
      "error",
    );
    return;
  }
  captureChatName.textContent = preview.chatName;
  previewLoaded.textContent = String(preview.loadedMessageCount);
  previewParticipants.textContent = String(preview.participantLabelCount);
  previewMedia.textContent = String(preview.mediaCount);
  previewSkipped.textContent = String(preview.skippedCount);
  previewUnreadable.textContent = String(preview.unreadableCount);
  captureRange.textContent = `Oldest: ${formatPreviewTimestamp(preview.oldestTimestamp)} · Newest: ${formatPreviewTimestamp(preview.newestTimestamp)}`;
  previewCountLabel.textContent =
    operation.mode === "loaded" ? "Loaded messages" : "Captured messages";
  captureScope.textContent =
    operation.mode === "guided"
      ? `Only the guided messages counted above will be uploaded. ${guidedStopReasonLabel(operation.stopReason)} Nothing is sent until you confirm.`
      : operation.mode === "automatic"
        ? `Only the automatically collected messages counted above will be uploaded. ${automaticStopReasonLabel(operation.stopReason)} Nothing is sent until you confirm.`
        : "Only the loaded messages counted above will be uploaded. Unloaded older messages are excluded. Nothing is sent until you confirm.";
  previewWarning.textContent = operation.alignmentWarningCount
    ? `${operation.alignmentWarningCount} ambiguous overlap${operation.alignmentWarningCount === 1 ? " was" : "s were"} retained for review; no candidate occurrence was silently removed.`
    : "";
  previewWarning.classList.toggle("show", operation.alignmentWarningCount > 0);
  confirmCapture.disabled = false;
}

function renderCaptureOperation(operation) {
  if (!operation) return;
  currentOperation = operation;
  if (
    ["received", "duplicate"].includes(operation.state) &&
    operation.completedAt &&
    (!operationalState.lastCapture ||
      Date.parse(operation.completedAt) >=
        Date.parse(operationalState.lastCapture.completedAt))
  ) {
    operationalState = {
      ...operationalState,
      lastCapture: {
        count: operation.extractedCount,
        completedAt: operation.completedAt,
        state: operation.state,
        resultPath: operation.resultPath,
        reconciliationRequired: Boolean(operation.reconciliationRequired),
      },
    };
  }
  renderOperationalActions();
  const operationOwnsMode = [
    "inspecting",
    "collecting",
    "paused",
    "ready-for-review",
    "uploading",
    "retry-required",
  ].includes(operation.state);
  const selectedMode = operationOwnsMode
    ? operation.mode
    : operationalState.preferredMode;
  const modeValue = selectedMode === "guided" ? "scroll" : selectedMode;
  document.querySelectorAll('input[name="captureMode"]').forEach((input) => {
    input.checked = input.value === modeValue;
    input.closest(".capture-mode")?.classList.toggle("selected", input.checked);
    const status = input.closest(".capture-mode")?.querySelector("em");
    if (status) {
      status.textContent = input.checked ? "Selected" : "Available";
    }
  });
  automaticOptions.classList.toggle("show", modeValue === "automatic");
  const count = operation.extractedCount || 0;
  const busy = ["inspecting", "collecting", "paused", "uploading"].includes(
    operation.state,
  );
  extractBtn.disabled = busy;
  confirmCapture.disabled = operation.state === "uploading";
  cancelCapture.disabled = operation.state === "uploading";
  extractBtn.textContent =
    selectedMode === "guided"
      ? operationOwnsMode && operation.state === "collecting"
        ? `Guided: ${count} captured`
        : "Start guided capture"
      : selectedMode === "automatic"
        ? operationOwnsMode &&
          ["collecting", "paused"].includes(operation.state)
          ? `Automatic: ${count} captured`
          : "Load older messages"
        : "Review loaded messages";

  const collectionActive =
    ["guided", "automatic"].includes(operation.mode) &&
    ["collecting", "paused"].includes(operation.state);
  guidedProgress.classList.toggle("show", collectionActive);
  if (collectionActive) {
    const automatic = operation.mode === "automatic";
    collectionProgressTitle.textContent = automatic
      ? operation.state === "paused"
        ? "Automatic capture is paused"
        : "Automatic capture is active"
      : "Guided capture is active";
    collectionProgressInstruction.textContent = automatic
      ? "Keep this chat open. ConvoLens is loading older history within the selected boundary."
      : "Scroll upward in this chat. ConvoLens will retain each message window before WhatsApp removes it.";
    pauseAutomaticCapture.hidden =
      !automatic || !operation.automaticControlsReady;
    stopGuidedCapture.hidden = automatic && !operation.automaticControlsReady;
    pauseAutomaticCapture.textContent =
      operation.state === "paused" ? "Resume" : "Pause";
    guidedCount.textContent = String(count);
    guidedOldest.textContent = formatPreviewTimestamp(
      operation.oldestTimestamp,
    );
    guidedWarning.textContent = operation.alignmentWarningCount
      ? "An overlap could not be aligned unambiguously. Candidate occurrences were retained; use smaller upward scroll steps."
      : "";
    guidedWarning.classList.toggle("show", operation.alignmentWarningCount > 0);
  }

  if (["ready-for-review", "retry-required"].includes(operation.state)) {
    capturePreview.classList.add("show");
    void renderCapturePreview(operation).catch((error) => {
      confirmCapture.disabled = true;
      setActionStatus(normalizeExtensionError(error), "error");
    });
  } else {
    clearCapturePreview();
  }

  switch (operation.state) {
    case "inspecting":
      setActionStatus("Reading loaded messages…", "info");
      break;
    case "collecting":
      setActionStatus(
        operation.mode === "guided"
          ? `Guided capture active: ${count} unique message${count === 1 ? "" : "s"}.`
          : operation.mode === "automatic"
            ? `Automatic capture active: ${count} unique message${count === 1 ? "" : "s"}.`
            : "Reading loaded messages…",
        "info",
      );
      break;
    case "paused":
      setActionStatus(
        `Automatic capture paused at ${count} unique message${count === 1 ? "" : "s"}.`,
        "info",
      );
      break;
    case "ready-for-review":
      setActionStatus(
        `Review the ${operation.mode === "loaded" ? "loaded-message" : "collected-message"} scope, then confirm or cancel.`,
        "info",
      );
      break;
    case "uploading":
      setActionStatus(`Sending ${count} loaded messages…`, "info");
      break;
    case "received":
      setActionStatus(
        operation.reconciliationRequired
          ? `${count} loaded messages stored separately. Review the possible prior intake in ConvoLens.`
          : `${count} loaded message${count === 1 ? "" : "s"} received by ConvoLens.`,
        "success",
      );
      break;
    case "duplicate":
      setActionStatus(
        operation.reconciliationRequired
          ? `${count} loaded messages stored separately. Review the possible prior intake in ConvoLens.`
          : `${count} loaded message${count === 1 ? "" : "s"} already exists in ConvoLens.`,
        "success",
      );
      break;
    case "retry-required":
      setActionStatus(
        operation.reason || "Upload not sent. Review and retry from this tab.",
        "error",
      );
      break;
    case "failed":
    case "cancelled":
      setActionStatus(operation.reason || "Capture cancelled.", "error");
      break;
  }
}

function isWhatsAppTab(tab) {
  return tab?.url?.startsWith("https://web.whatsapp.com/");
}

async function getWhatsAppTab() {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (isWhatsAppTab(activeTab)) return activeTab;

  const whatsappTabs = await chrome.tabs.query({
    url: "https://web.whatsapp.com/*",
  });
  return whatsappTabs.find((tab) => !tab.discarded) || whatsappTabs[0];
}

async function sendToWhatsApp(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    if (!error?.message?.includes("Receiving end does not exist")) throw error;

    // Declarative content scripts are not reattached to an already-open tab
    // when an unpacked extension is reloaded. Inject the verified bundle once
    // and retry so the operator does not need to chase Chrome lifecycle state.
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["dist/content.css"],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["dist/whatsapp-page-identity.js"],
      world: "MAIN",
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["dist/content.js"],
    });

    return chrome.tabs.sendMessage(tabId, message);
  }
}

// Initialize popup
async function init() {
  // Check auth status
  const authStatus = await sendRuntimeMessage({
    action: "GET_AUTH_STATUS",
  });

  if (authStatus.data?.isAuthenticated) {
    showLoggedIn(authStatus.data.user);
    await refreshOperationalState();
  } else {
    showLoggedOut();
    operationalActions.hidden = true;
  }

  // Check WhatsApp Web connection
  await checkWhatsAppStatus();
  if (activeWhatsAppTabId) {
    const operationResponse = await sendRuntimeMessage({
      action: "GET_CAPTURE_OPERATION",
      tabId: activeWhatsAppTabId,
    });
    if (operationResponse.success && operationResponse.data) {
      renderCaptureOperation(operationResponse.data);
    }
  }
}

async function refreshOperationalState() {
  const operationalResponse = await sendRuntimeMessage({
    action: "GET_CAPTURE_OPERATIONAL_STATE",
  });
  if (operationalResponse.success && operationalResponse.data) {
    operationalState = operationalResponse.data;
    applyPopupCaptureMode(
      operationalState.preferredMode === "guided"
        ? "scroll"
        : operationalState.preferredMode,
    );
  }
  renderOperationalActions();
}

// Show logged in state
function showLoggedIn(user) {
  loggedOutSection.style.display = "none";
  loggedInSection.style.display = "block";

  if (user) {
    const email = user.email || "";
    userName.textContent = user.name || email.split("@")[0] || "Mystira User";
    userEmail.textContent = email;
    userAvatar.textContent = (user.name || email || "U")[0].toUpperCase();
  }
}

// Show logged out state
function showLoggedOut() {
  loggedOutSection.style.display = "block";
  loggedInSection.style.display = "none";
}

// Check WhatsApp Web status
async function checkWhatsAppStatus() {
  try {
    const tab = await getWhatsAppTab();

    if (tab?.id) {
      activeWhatsAppTabId = tab.id;
      const response = await sendToWhatsApp(tab.id, {
        action: "CHECK_STATUS",
      });

      // The TypeScript content script wraps status payloads in the shared
      // ExtensionResponse shape. Keep the legacy fallback for older builds
      // that returned these fields at the top level.
      const connectionStatus = response.data || response;

      if (connectionStatus.isWhatsAppWeb && connectionStatus.isLoggedIn) {
        statusDot.classList.add("connected");
        statusText.textContent = "Connected to WhatsApp Web";
      } else {
        statusText.textContent = "WhatsApp Web not logged in";
      }
    } else {
      statusText.textContent = "Open WhatsApp Web to start";
    }
  } catch (error) {
    statusText.textContent = "Extension is reconnecting — refresh WhatsApp Web";
  }
}

function setLoginBtnBusy(busy, label) {
  loginSpinner.hidden = !busy;
  loginBtnLabel.textContent = label;
  loginBtn.disabled = busy;
}

// Event Listeners
loginBtn.addEventListener("click", async () => {
  loginError.textContent = "";
  setLoginBtnBusy(true, "Checking your ConvoLens session…");
  setActionStatus("Looking for a signed-in ConvoLens session…", "info");

  try {
    const result = await sendRuntimeMessage({ action: "SYNC_MYSTIRA_AUTH" });
    if (result.success) {
      setLoginBtnBusy(true, "Connected — loading extension…");
      showLoggedIn(result.data?.user);
      await refreshOperationalState();
      setActionStatus(
        "Connected. Choose a WhatsApp chat and review its loaded messages.",
        "success",
      );
    } else {
      loginError.textContent =
        result.error || "Complete sign in, then try again.";
      setActionStatus(
        "Not signed in yet. Complete sign in in the new tab, then try again.",
        "error",
      );
      openTab(
        `${DASHBOARD_URL}/login?callbackUrl=${encodeURIComponent("/dashboard/import")}`,
      );
    }
  } catch (error) {
    const message = normalizeExtensionError(error);
    loginError.textContent = message;
    setActionStatus(message, "error");
  } finally {
    setLoginBtnBusy(false, "I've signed in — connect");
  }
});

signupBtn.addEventListener("click", () => {
  openTab(
    `${DASHBOARD_URL}/login?callbackUrl=${encodeURIComponent("/dashboard/import")}`,
  );
});

logoutBtn.addEventListener("click", async () => {
  try {
    await sendRuntimeMessage({ action: "LOGOUT" });
    currentOperation = null;
    clearCapturePreview();
    guidedProgress.classList.remove("show");
    showLoggedOut();
  } catch (error) {
    setActionStatus(normalizeExtensionError(error), "error");
  }
});

extractBtn.addEventListener("click", async () => {
  const selectedMode = document.querySelector(
    'input[name="captureMode"]:checked',
  )?.value;
  const mode =
    selectedMode === "scroll"
      ? "guided"
      : selectedMode === "automatic"
        ? "automatic"
        : "loaded";
  if (mode === "automatic" && !automaticConsent.checked) {
    setActionStatus(
      "Confirm that WhatsApp may scroll this chat before starting automatic capture.",
      "error",
    );
    return;
  }
  const defaultLabel =
    mode === "guided"
      ? "Start guided capture"
      : mode === "automatic"
        ? "Load older messages"
        : "Review loaded messages";
  setActionStatus("");

  try {
    const tab = await getWhatsAppTab();

    if (!tab?.id) {
      setActionStatus("Open WhatsApp Web and select a chat first.", "error");
      return;
    }
    activeWhatsAppTabId = tab.id;

    extractBtn.textContent = "Reading loaded messages…";
    extractBtn.disabled = true;

    const response = await sendRuntimeMessage({
      action: "START_CAPTURE_OPERATION",
      tabId: tab.id,
      initiator: "popup",
      mode,
      ...(mode === "automatic"
        ? { automaticBoundary: selectedAutomaticBoundary() }
        : {}),
    });

    if (response.success && response.data) {
      renderCaptureOperation(response.data);
    } else {
      setActionStatus(
        response.error ||
          "No readable messages were found in the selected chat.",
        "error",
      );
    }
  } catch (error) {
    setActionStatus(normalizeExtensionError(error), "error");
  } finally {
    window.setTimeout(() => {
      extractBtn.textContent = defaultLabel;
    }, 1500);
    extractBtn.disabled = Boolean(
      currentOperation &&
        ["inspecting", "collecting", "paused", "uploading"].includes(
          currentOperation.state,
        ),
    );
  }
});

stopGuidedCapture.addEventListener("click", async () => {
  if (!currentOperation || !activeWhatsAppTabId) return;
  stopGuidedCapture.disabled = true;
  cancelGuidedCapture.disabled = true;
  try {
    const automatic = currentOperation.mode === "automatic";
    const response = await sendRuntimeMessage({
      action: automatic
        ? "CONTROL_AUTOMATIC_CAPTURE_OPERATION"
        : "STOP_GUIDED_CAPTURE_OPERATION",
      tabId: activeWhatsAppTabId,
      operationId: currentOperation.operationId,
      ...(automatic
        ? { command: "stop", stopReason: "automatic-user-stopped" }
        : { stopReason: "guided-user-stopped" }),
    });
    if (response.success && response.data)
      renderCaptureOperation(response.data);
    else
      setActionStatus(
        response.error || "Guided capture could not stop.",
        "error",
      );
  } catch (error) {
    setActionStatus(normalizeExtensionError(error), "error");
  } finally {
    stopGuidedCapture.disabled = false;
    cancelGuidedCapture.disabled = false;
  }
});

pauseAutomaticCapture.addEventListener("click", async () => {
  if (!currentOperation || !activeWhatsAppTabId) return;
  pauseAutomaticCapture.disabled = true;
  try {
    const response = await sendRuntimeMessage({
      action: "CONTROL_AUTOMATIC_CAPTURE_OPERATION",
      tabId: activeWhatsAppTabId,
      operationId: currentOperation.operationId,
      command: currentOperation.state === "paused" ? "resume" : "pause",
    });
    if (response.success && response.data)
      renderCaptureOperation(response.data);
    else
      setActionStatus(
        response.error || "Automatic capture could not be updated.",
        "error",
      );
  } catch (error) {
    setActionStatus(normalizeExtensionError(error), "error");
  } finally {
    pauseAutomaticCapture.disabled = false;
  }
});

cancelGuidedCapture.addEventListener("click", () => {
  if (!currentOperation || !activeWhatsAppTabId) return;
  sendRuntimeMessage({
    action: "CANCEL_CAPTURE_OPERATION",
    tabId: activeWhatsAppTabId,
    operationId: currentOperation.operationId,
    reason: "Upload cancelled. Nothing was sent.",
  })
    .then((response) => {
      if (response.success && response.data)
        renderCaptureOperation(response.data);
      else if (!response.success) setActionStatus(response.error, "error");
    })
    .catch((error) => setActionStatus(normalizeExtensionError(error), "error"));
});

confirmCapture.addEventListener("click", async () => {
  if (!currentOperation || !activeWhatsAppTabId) return;
  const operationId = currentOperation.operationId;
  confirmCapture.disabled = true;
  cancelCapture.disabled = true;
  extractBtn.disabled = true;
  logoutBtn.disabled = true;
  setActionStatus(
    `Sending ${currentOperation.extractedCount} loaded messages…`,
    "info",
  );

  try {
    const sendResult = await sendRuntimeMessage({
      action: "CONFIRM_CAPTURE_OPERATION",
      tabId: activeWhatsAppTabId,
      operationId,
    });
    if (sendResult.success && sendResult.data) {
      renderCaptureOperation(sendResult.data);
    } else {
      setActionStatus(
        sendResult.retryRequired
          ? "Upload not sent. Keep this popup open to retry, or recapture and review again."
          : sendResult.error ||
              "ConvoLens could not receive these loaded messages.",
        "error",
      );
    }
  } catch (error) {
    setActionStatus(normalizeExtensionError(error), "error");
  } finally {
    confirmCapture.disabled = false;
    cancelCapture.disabled = false;
    extractBtn.disabled = false;
    logoutBtn.disabled = false;
  }
});

cancelCapture.addEventListener("click", () => {
  if (!currentOperation || !activeWhatsAppTabId) return;
  sendRuntimeMessage({
    action: "CANCEL_CAPTURE_OPERATION",
    tabId: activeWhatsAppTabId,
    operationId: currentOperation.operationId,
    reason: "Upload cancelled. Nothing was sent.",
  })
    .then((response) => {
      if (response.success && response.data)
        renderCaptureOperation(response.data);
      else if (!response.success) setActionStatus(response.error, "error");
    })
    .catch((error) => setActionStatus(normalizeExtensionError(error), "error"));
});

async function discardUnconfirmedCaptureForModeChange(selectedMode) {
  const selectedOperationMode =
    selectedMode === "scroll"
      ? "guided"
      : selectedMode === "automatic"
        ? "automatic"
        : "loaded";
  if (
    !currentOperation ||
    !activeWhatsAppTabId ||
    currentOperation.mode === selectedOperationMode ||
    ![
      "inspecting",
      "collecting",
      "paused",
      "ready-for-review",
      "retry-required",
    ].includes(currentOperation.state)
  ) {
    return;
  }
  await sendRuntimeMessage({
    action: "CANCEL_CAPTURE_OPERATION",
    tabId: activeWhatsAppTabId,
    operationId: currentOperation.operationId,
    reason: "Capture mode changed. The unconfirmed buffer was discarded.",
  });
  currentOperation = null;
  clearCapturePreview();
  guidedProgress.classList.remove("show");
}

function applyPopupCaptureMode(selectedMode) {
  document
    .querySelectorAll('input[name="captureMode"]')
    .forEach((modeInput) => {
      const selected = modeInput.value === selectedMode;
      modeInput.checked = selected;
      const label = modeInput.closest(".capture-mode");
      label?.classList.toggle("selected", selected);
      const status = label?.querySelector("em");
      if (status) {
        status.textContent = selected ? "Selected" : "Available";
      }
    });
  automaticOptions.classList.toggle("show", selectedMode === "automatic");
  extractBtn.textContent =
    selectedMode === "scroll"
      ? "Start guided capture"
      : selectedMode === "automatic"
        ? "Load older messages"
        : "Review loaded messages";
}

document.querySelectorAll('input[name="captureMode"]').forEach((input) => {
  input.addEventListener("change", () => {
    const selectedMode = input.value;
    const generation = ++captureModeChangeGeneration;
    applyPopupCaptureMode(selectedMode);
    const preferredMode =
      selectedMode === "scroll"
        ? "guided"
        : selectedMode === "automatic"
          ? "automatic"
          : "loaded";
    operationalState = { ...operationalState, preferredMode };
    void sendRuntimeMessage({
      action: "SET_PREFERRED_CAPTURE_MODE",
      mode: preferredMode,
    }).catch(() => undefined);
    void discardUnconfirmedCaptureForModeChange(selectedMode)
      .catch((error) =>
        setActionStatus(normalizeExtensionError(error), "error"),
      )
      .finally(() => {
        if (generation === captureModeChangeGeneration) {
          applyPopupCaptureMode(selectedMode);
        }
      });
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (
    message?.action === "CAPTURE_OPERATION_UPDATED" &&
    message.operation?.tabId === activeWhatsAppTabId
  ) {
    renderCaptureOperation(message.operation);
  }
});

openDashboard.addEventListener("click", () => {
  openTab(`${DASHBOARD_URL}/dashboard`);
});

openConversation.addEventListener("click", async () => {
  try {
    const path = currentResultPath();
    if (!path) return;
    const response = await sendRuntimeMessage({
      action: "OPEN_DASHBOARD",
      path,
    });
    if (!response.success) setActionStatus(response.error, "error");
  } catch (error) {
    setActionStatus(normalizeExtensionError(error), "error");
  }
});

exportCapture.addEventListener("click", async () => {
  try {
    if (!activeWhatsAppTabId || !currentOperation) return;
    const response = await sendToWhatsApp(activeWhatsAppTabId, {
      action: "EXPORT_CAPTURE_OPERATION_PAYLOAD",
      operationId: currentOperation.operationId,
    });
    if (response.success) {
      setActionStatus(
        `Exported ${response.data?.filename || "reviewed capture"}.`,
        "success",
      );
    } else {
      setActionStatus(response.error, "error");
    }
  } catch (error) {
    setActionStatus(normalizeExtensionError(error), "error");
  }
});

// Initialize
init().catch((error) => {
  setActionStatus(normalizeExtensionError(error), "error");
});
