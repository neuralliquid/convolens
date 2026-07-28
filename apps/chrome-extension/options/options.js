/**
 * ConvoLens Chrome Extension - Options Page Script
 */

// Storage keys (must match config.ts)
const STORAGE_KEYS = {
  authToken: "authToken",
  user: "user",
  settings: "settings",
  extractionHistory: "extractionHistory",
  pendingUploads: "pendingUploads",
};

// Default settings
const DEFAULT_SETTINGS = {
  autoExtract: false,
  showNotifications: true,
  extractMediaMetadata: true,
  maxStoredExtractions: 50,
  theme: "auto",
  apiEndpoint: "",
};

const DASHBOARD_URL = "https://convolens.neuralliquid.ai";

// DOM Elements
const elements = {
  // Account
  loggedOut: document.getElementById("loggedOut"),
  loggedIn: document.getElementById("loggedIn"),
  userEmail: document.getElementById("userEmail"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),

  // Settings
  showNotifications: document.getElementById("showNotifications"),
  extractMediaMetadata: document.getElementById("extractMediaMetadata"),
  theme: document.getElementById("theme"),
  apiEndpoint: document.getElementById("apiEndpoint"),
  maxStoredExtractions: document.getElementById("maxStoredExtractions"),

  // Stats
  totalExtractions: document.getElementById("totalExtractions"),
  pendingUploads: document.getElementById("pendingUploads"),
  totalMessages: document.getElementById("totalMessages"),

  // History
  historyList: document.getElementById("historyList"),

  // Actions
  legacyQueueSummary: document.getElementById("legacyQueueSummary"),
  legacyQueueActions: document.getElementById("legacyQueueActions"),
  exportPending: document.getElementById("exportPending"),
  deletePending: document.getElementById("deletePending"),
  clearData: document.getElementById("clearData"),
  statusMessage: document.getElementById("statusMessage"),

  // Footer
  version: document.getElementById("version"),
  helpLink: document.getElementById("helpLink"),
  privacyLink: document.getElementById("privacyLink"),
};

function normalizeExtensionError(error) {
  const message =
    typeof error === "string"
      ? error
      : error?.message || "Extension unavailable";
  if (
    /message port closed|receiving end does not exist|context invalidated/i.test(
      message,
    )
  ) {
    return "The extension channel closed. Reopen settings and try again.";
  }
  return message;
}

async function sendRuntimeMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    throw new Error(normalizeExtensionError(error));
  }
}

function runAction(action) {
  Promise.resolve()
    .then(action)
    .catch((error) => showStatus(normalizeExtensionError(error), "error"));
}

// =============================================================================
// Initialization
// =============================================================================

async function init() {
  // Set version
  elements.version.textContent = chrome.runtime.getManifest().version;

  // Load and display data
  await loadAuthStatus();
  await loadSettings();
  await loadStats();
  await loadHistory();

  // Set up event listeners
  setupEventListeners();

  // Set up links
  elements.helpLink.href = `${DASHBOARD_URL}/help`;
  elements.privacyLink.href = `${DASHBOARD_URL}/privacy`;
}

function setupEventListeners() {
  // Auth buttons
  elements.loginBtn.addEventListener("click", handleLogin);
  elements.logoutBtn.addEventListener("click", () => runAction(handleLogout));

  // Settings changes
  elements.showNotifications.addEventListener("change", () =>
    runAction(saveSettings),
  );
  elements.extractMediaMetadata.addEventListener("change", () =>
    runAction(saveSettings),
  );
  elements.theme.addEventListener("change", () => runAction(saveSettings));
  elements.apiEndpoint.addEventListener("blur", () => runAction(saveSettings));
  elements.maxStoredExtractions.addEventListener("change", () =>
    runAction(saveSettings),
  );

  // Actions
  elements.exportPending.addEventListener("click", () =>
    runAction(handleExportPending),
  );
  elements.deletePending.addEventListener("click", () =>
    runAction(handleDeletePending),
  );
  elements.clearData.addEventListener("click", () =>
    runAction(handleClearData),
  );
}

// =============================================================================
// Auth
// =============================================================================

async function loadAuthStatus() {
  const response = await sendRuntimeMessage({
    action: "GET_AUTH_STATUS",
  });

  if (response.data?.isAuthenticated) {
    elements.loggedOut.style.display = "none";
    elements.loggedIn.style.display = "block";
    elements.userEmail.textContent = response.data.user?.email || "Connected";
  } else {
    elements.loggedOut.style.display = "block";
    elements.loggedIn.style.display = "none";
  }
}

function handleLogin() {
  chrome.tabs.create({ url: `${DASHBOARD_URL}/login?extension=true` });
}

async function handleLogout() {
  await sendRuntimeMessage({ action: "LOGOUT" });
  await loadAuthStatus();
  showStatus("Logged out successfully", "success");
}

// =============================================================================
// Settings
// =============================================================================

async function loadSettings() {
  const response = await sendRuntimeMessage({ action: "GET_SETTINGS" });
  const settings = response.data || DEFAULT_SETTINGS;

  elements.showNotifications.checked = settings.showNotifications;
  elements.extractMediaMetadata.checked = settings.extractMediaMetadata;
  elements.theme.value = settings.theme;
  elements.apiEndpoint.value = settings.apiEndpoint || "";
  elements.maxStoredExtractions.value =
    settings.maxStoredExtractions.toString();
}

async function saveSettings() {
  const settings = {
    showNotifications: elements.showNotifications.checked,
    extractMediaMetadata: elements.extractMediaMetadata.checked,
    theme: elements.theme.value,
    apiEndpoint: elements.apiEndpoint.value.trim(),
    maxStoredExtractions: parseInt(elements.maxStoredExtractions.value, 10),
  };

  const response = await sendRuntimeMessage({
    action: "UPDATE_SETTINGS",
    settings,
  });

  if (response.success) {
    showStatus("Settings saved", "success");
  } else {
    showStatus("Failed to save settings", "error");
  }
}

// =============================================================================
// Statistics
// =============================================================================

async function loadStats() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.extractionHistory,
    STORAGE_KEYS.pendingUploads,
  ]);

  const history = stored[STORAGE_KEYS.extractionHistory] || [];
  const pending = stored[STORAGE_KEYS.pendingUploads] || [];

  elements.totalExtractions.textContent = history.length.toString();
  elements.pendingUploads.textContent = pending.length.toString();

  if (pending.length === 0) {
    elements.legacyQueueSummary.textContent = "No legacy local captures found.";
    elements.legacyQueueActions.style.display = "none";
  } else {
    const queuedTimes = pending
      .map((item) => Number(item?.queuedAt))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);
    const timeSummary = queuedTimes.length
      ? ` Stored between ${new Date(queuedTimes[0]).toLocaleString()} and ${new Date(queuedTimes[queuedTimes.length - 1]).toLocaleString()}.`
      : " Stored time is unavailable.";
    elements.legacyQueueSummary.textContent = `${pending.length} unowned legacy local capture${pending.length === 1 ? "" : "s"}.${timeSummary}`;
    elements.legacyQueueActions.style.display = "flex";
  }

  // Calculate total messages
  const totalMessages = history.reduce(
    (sum, item) => sum + (item.messageCount || 0),
    0,
  );
  elements.totalMessages.textContent = formatNumber(totalMessages);
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

// =============================================================================
// History
// =============================================================================

async function loadHistory() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.extractionHistory,
  ]);
  const history = stored[STORAGE_KEYS.extractionHistory] || [];

  if (history.length === 0) {
    elements.historyList.innerHTML = `
      <p style="color: #666; text-align: center; padding: 20px;">No extractions yet</p>
    `;
    return;
  }

  elements.historyList.innerHTML = history
    .slice(0, 20)
    .map(
      (item) => `
      <div class="history-item">
        <div>
          <div class="history-name">${escapeHtml(item.chatName)}</div>
          <div class="history-meta">${item.messageCount} messages</div>
        </div>
        <div class="history-meta">${formatDate(item.extractedAt)}</div>
      </div>
    `,
    )
    .join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

// =============================================================================
// Actions
// =============================================================================

async function handleExportPending() {
  elements.exportPending.disabled = true;
  try {
    const stored = await chrome.storage.local.get([
      STORAGE_KEYS.pendingUploads,
    ]);
    const pending = stored[STORAGE_KEYS.pendingUploads] || [];
    if (pending.length === 0) {
      showStatus("No legacy local captures to export", "error");
      return;
    }

    const blob = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), pendingUploads: pending },
          null,
          2,
        ),
      ],
      {
        type: "application/json",
      },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `convolens-legacy-local-captures-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showStatus(
      "Local queue exported. It remains stored until you delete it.",
      "success",
    );
  } catch (error) {
    showStatus(normalizeExtensionError(error), "error");
  } finally {
    elements.exportPending.disabled = false;
  }
}

async function handleDeletePending() {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.pendingUploads]);
  const pending = stored[STORAGE_KEYS.pendingUploads] || [];
  if (pending.length === 0) return;
  if (
    !confirm(
      `Delete ${pending.length} unowned legacy local capture${pending.length === 1 ? "" : "s"}? Export first if you need a backup. This cannot be undone.`,
    )
  ) {
    return;
  }

  try {
    await chrome.storage.local.remove(STORAGE_KEYS.pendingUploads);
    showStatus("Legacy local queue deleted", "success");
    await loadStats();
  } catch (error) {
    showStatus(normalizeExtensionError(error), "error");
  }
}

async function handleClearData() {
  if (
    !confirm(
      "Are you sure you want to clear all extension data? This cannot be undone.",
    )
  ) {
    return;
  }

  try {
    await chrome.storage.local.clear();

    // Re-initialize default settings
    await chrome.storage.local.set({
      [STORAGE_KEYS.settings]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.extractionHistory]: [],
    });

    showStatus("All data cleared", "success");
    await loadAuthStatus();
    await loadStats();
    await loadHistory();
  } catch (error) {
    showStatus("Error: " + error.message, "error");
  }
}

// =============================================================================
// UI Helpers
// =============================================================================

function showStatus(message, type) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status show ${type}`;

  setTimeout(() => {
    elements.statusMessage.classList.remove("show");
  }, 3000);
}

// =============================================================================
// Initialize
// =============================================================================

init().catch((error) => {
  showStatus(normalizeExtensionError(error), "error");
});
