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

function setActionStatus(message = "", type = "info") {
  actionStatus.textContent = message;
  actionStatus.className = message
    ? `action-status show ${type}`
    : "action-status";
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
  const authStatus = await chrome.runtime.sendMessage({
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

  const result = await chrome.runtime.sendMessage({
    action: "SYNC_MYSTIRA_AUTH",
  });

  loginBtn.textContent = "I've signed in — connect";
  loginBtn.disabled = false;

  if (result.success) {
    showLoggedIn(result.data?.user);
    loginError.textContent = "";
    setActionStatus("Connected. Choose a WhatsApp chat to send.", "success");
  } else {
    loginError.textContent =
      result.error || "Complete sign in, then try again.";
    chrome.tabs.create({
      url: `${DASHBOARD_URL}/login?callbackUrl=${encodeURIComponent("/dashboard/import")}`,
    });
  }
});

signupBtn.addEventListener("click", () => {
  chrome.tabs.create({
    url: `${DASHBOARD_URL}/login?callbackUrl=${encodeURIComponent("/dashboard/import")}`,
  });
});

logoutBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ action: "LOGOUT" });
  showLoggedOut();
});

extractBtn.addEventListener("click", async () => {
  const defaultLabel = "Send Current Chat";
  setActionStatus("");

  try {
    const tab = await getWhatsAppTab();

    if (!tab?.id) {
      setActionStatus("Open WhatsApp Web and select a chat first.", "error");
      return;
    }

    extractBtn.textContent = "Reading chat…";
    extractBtn.disabled = true;

    const response = await sendToWhatsApp(tab.id, {
      action: "GET_CURRENT_CHAT",
    });

    if (response.success) {
      const sendResult = await chrome.runtime.sendMessage({
        action: "SEND_CHAT_DATA",
        data: response.data,
      });

      if (sendResult.success) {
        extractBtn.textContent = "Sent";
        const messageCount = response.data?.messages?.length;
        setActionStatus(
          messageCount
            ? `${messageCount} messages received by ConvoLens.`
            : "Chat received by ConvoLens.",
          "success",
        );
      } else {
        const wasSaved = sendResult.error?.toLowerCase().includes("saved");
        setActionStatus(
          sendResult.error ||
            "ConvoLens could not receive this chat. Please try again.",
          wasSaved ? "info" : "error",
        );
      }
    } else {
      setActionStatus(
        response.error ||
          "No readable messages were found in the selected chat.",
        "error",
      );
    }
  } catch (error) {
    const receiverUnavailable = error?.message?.includes(
      "Receiving end does not exist",
    );
    setActionStatus(
      receiverUnavailable
        ? "Refresh WhatsApp Web once, then reopen the chat."
        : error?.message ||
            "The extension could not read this chat. Please try again.",
      "error",
    );
  } finally {
    window.setTimeout(() => {
      extractBtn.textContent = defaultLabel;
    }, 1500);
    extractBtn.disabled = false;
  }
});

openDashboard.addEventListener("click", () => {
  chrome.tabs.create({ url: `${DASHBOARD_URL}/dashboard/import` });
});

// Initialize
init();
