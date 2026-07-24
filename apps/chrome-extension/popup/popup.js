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
    const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });

    if (tabs.length > 0) {
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: "CHECK_STATUS",
      });

      if (response.isWhatsAppWeb && response.isLoggedIn) {
        statusDot.classList.add("connected");
        statusText.textContent = "Connected to WhatsApp Web";
      } else {
        statusText.textContent = "WhatsApp Web not logged in";
      }
    } else {
      statusText.textContent = "Open WhatsApp Web to start";
    }
  } catch (error) {
    statusText.textContent = "Open WhatsApp Web to start";
  }
}

// Event Listeners
loginBtn.addEventListener("click", async () => {
  loginBtn.textContent = "Connecting...";
  loginBtn.disabled = true;

  const result = await chrome.runtime.sendMessage({
    action: "SYNC_MYSTIRA_AUTH",
  });

  loginBtn.textContent = "Connect Mystira Session";
  loginBtn.disabled = false;

  if (result.success) {
    showLoggedIn(result.data?.user);
    loginError.textContent = "";
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
  try {
    const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });

    if (tabs.length === 0) {
      alert("Please open WhatsApp Web first");
      return;
    }

    extractBtn.textContent = "Extracting...";
    extractBtn.disabled = true;

    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: "GET_CURRENT_CHAT",
    });

    if (response.success) {
      const sendResult = await chrome.runtime.sendMessage({
        action: "SEND_CHAT_DATA",
        data: response.data,
      });

      if (sendResult.success) {
        extractBtn.textContent = "Sent!";
        setTimeout(() => {
          extractBtn.textContent = "Extract Current Chat";
          extractBtn.disabled = false;
        }, 2000);
      } else {
        alert("Failed to send: " + sendResult.error);
        extractBtn.textContent = "Extract Current Chat";
        extractBtn.disabled = false;
      }
    } else {
      alert("Failed to extract: " + response.error);
      extractBtn.textContent = "Extract Current Chat";
      extractBtn.disabled = false;
    }
  } catch (error) {
    alert("Error: " + error.message);
    extractBtn.textContent = "Extract Current Chat";
    extractBtn.disabled = false;
  }
});

openDashboard.addEventListener("click", () => {
  chrome.tabs.create({ url: `${DASHBOARD_URL}/dashboard/import` });
});

// Initialize
init();
