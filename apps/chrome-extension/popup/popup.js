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
const captureSummary = document.getElementById("captureSummary");
const confirmCapture = document.getElementById("confirmCapture");
const cancelCapture = document.getElementById("cancelCapture");

let pendingCapture = null;

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
  pendingCapture = null;
  captureSummary.textContent = "";
  capturePreview.classList.remove("show");
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
  checkWhatsAppStatus();
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
    clearCapturePreview();
    showLoggedOut();
  } catch (error) {
    setActionStatus(normalizeExtensionError(error), "error");
  }
});

extractBtn.addEventListener("click", async () => {
  const defaultLabel = "Review loaded messages";
  setActionStatus("");
  clearCapturePreview();

  try {
    const tab = await getWhatsAppTab();

    if (!tab?.id) {
      setActionStatus("Open WhatsApp Web and select a chat first.", "error");
      return;
    }

    extractBtn.textContent = "Reading loaded messages…";
    extractBtn.disabled = true;

    const response = await sendToWhatsApp(tab.id, {
      action: "GET_CURRENT_CHAT",
    });

    if (response.success) {
      const messageCount = response.data?.messages?.length || 0;
      if (!messageCount) {
        setActionStatus(
          "No readable loaded messages were found in the selected chat.",
          "error",
        );
        return;
      }
      pendingCapture = response.data;
      captureSummary.textContent = `${messageCount} loaded message${messageCount === 1 ? "" : "s"} from ${response.data.chatName || "the selected chat"}.`;
      capturePreview.classList.add("show");
      setActionStatus(
        "Review the loaded-message scope, then confirm or cancel.",
        "info",
      );
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
    extractBtn.disabled = false;
  }
});

confirmCapture.addEventListener("click", async () => {
  if (!pendingCapture) return;
  const captureToSend = pendingCapture;
  confirmCapture.disabled = true;
  cancelCapture.disabled = true;
  extractBtn.disabled = true;
  logoutBtn.disabled = true;
  setActionStatus(
    `Sending ${captureToSend.messages.length} loaded messages…`,
    "info",
  );

  try {
    const sendResult = await sendRuntimeMessage({
      action: "SEND_CHAT_DATA",
      data: captureToSend,
    });
    if (sendResult.success) {
      const messageCount = captureToSend.messages.length;
      if (pendingCapture === captureToSend) clearCapturePreview();
      setActionStatus(
        `${messageCount} loaded message${messageCount === 1 ? "" : "s"} received by ConvoLens.`,
        "success",
      );
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
  clearCapturePreview();
  setActionStatus("Upload cancelled. Nothing was sent.", "info");
});

openDashboard.addEventListener("click", () => {
  openTab(`${DASHBOARD_URL}/dashboard`);
});

// Initialize
init().catch((error) => {
  setActionStatus(normalizeExtensionError(error), "error");
});
