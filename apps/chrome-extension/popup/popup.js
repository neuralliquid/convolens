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
const signupBtn = document.getElementById("signupBtn");
const logoutBtn = document.getElementById("logoutBtn");
const extractBtn = document.getElementById("extractBtn");
const openDashboard = document.getElementById("openDashboard");
const loginError = document.getElementById("loginError");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userAvatar = document.getElementById("userAvatar");
const actionStatus = document.getElementById("actionStatus");
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

let currentOperation = null;
let activeWhatsAppTabId = null;
let captureModeChangeGeneration = 0;

extensionVersion.textContent = `v${chrome.runtime.getManifest().version}`;
dashboardLink.href = `${DASHBOARD_URL}/dashboard`;

function setActionStatus(message = "", type = "info") {
  actionStatus.textContent = message;
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
    operation.mode === "guided" ? "Captured messages" : "Loaded messages";
  captureScope.textContent =
    operation.mode === "guided"
      ? `Only the guided messages counted above will be uploaded. ${guidedStopReasonLabel(operation.stopReason)} Nothing is sent until you confirm.`
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
  const modeValue = operation.mode === "guided" ? "scroll" : "loaded";
  document.querySelectorAll('input[name="captureMode"]').forEach((input) => {
    input.checked = input.value === modeValue;
    input.closest(".capture-mode")?.classList.toggle("selected", input.checked);
    const status = input.closest(".capture-mode")?.querySelector("em");
    if (status && input.value !== "automatic") {
      status.textContent = input.checked ? "Selected" : "Available";
    }
  });
  const count = operation.extractedCount || 0;
  const busy = ["inspecting", "collecting", "uploading"].includes(
    operation.state,
  );
  extractBtn.disabled = busy;
  confirmCapture.disabled = operation.state === "uploading";
  cancelCapture.disabled = operation.state === "uploading";
  extractBtn.textContent =
    operation.mode === "guided"
      ? operation.state === "collecting"
        ? `Guided: ${count} captured`
        : "Start guided capture"
      : "Review loaded messages";

  const guidedActive =
    operation.mode === "guided" && operation.state === "collecting";
  guidedProgress.classList.toggle("show", guidedActive);
  if (guidedActive) {
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
          : "Reading loaded messages…",
        "info",
      );
      break;
    case "ready-for-review":
      setActionStatus(
        "Review the loaded-message scope, then confirm or cancel.",
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
  } else {
    showLoggedOut();
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

// Event Listeners
loginBtn.addEventListener("click", async () => {
  setActionStatus("");
  loginBtn.textContent = "Connecting…";
  loginBtn.disabled = true;

  try {
    const result = await sendRuntimeMessage({ action: "SYNC_MYSTIRA_AUTH" });
    if (result.success) {
      showLoggedIn(result.data?.user);
      loginError.textContent = "";
      setActionStatus(
        "Connected. Choose a WhatsApp chat and review its loaded messages.",
        "success",
      );
    } else {
      loginError.textContent =
        result.error || "Complete sign in, then try again.";
      openTab(
        `${DASHBOARD_URL}/login?callbackUrl=${encodeURIComponent("/dashboard/import")}`,
      );
    }
  } catch (error) {
    loginError.textContent = normalizeExtensionError(error);
  } finally {
    loginBtn.textContent = "I've signed in — connect";
    loginBtn.disabled = false;
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
  const mode = selectedMode === "scroll" ? "guided" : "loaded";
  const defaultLabel =
    mode === "guided" ? "Start guided capture" : "Review loaded messages";
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
        ["inspecting", "collecting", "uploading"].includes(
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
    const response = await sendRuntimeMessage({
      action: "STOP_GUIDED_CAPTURE_OPERATION",
      tabId: activeWhatsAppTabId,
      operationId: currentOperation.operationId,
      stopReason: "guided-user-stopped",
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
  const selectedOperationMode = selectedMode === "scroll" ? "guided" : "loaded";
  if (
    !currentOperation ||
    !activeWhatsAppTabId ||
    currentOperation.mode === selectedOperationMode ||
    !["collecting", "ready-for-review", "retry-required"].includes(
      currentOperation.state,
    )
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
      if (status && modeInput.value !== "automatic") {
        status.textContent = selected ? "Selected" : "Available";
      }
    });
  extractBtn.textContent =
    selectedMode === "scroll"
      ? "Start guided capture"
      : "Review loaded messages";
}

document.querySelectorAll('input[name="captureMode"]').forEach((input) => {
  input.addEventListener("change", () => {
    const selectedMode = input.value;
    const generation = ++captureModeChangeGeneration;
    applyPopupCaptureMode(selectedMode);
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

// Initialize
init().catch((error) => {
  setActionStatus(normalizeExtensionError(error), "error");
});
