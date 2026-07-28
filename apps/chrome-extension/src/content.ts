/**
 * ConvoLens Chrome Extension - Content Script (Production)
 *
 * Production-ready content script for WhatsApp Web message extraction.
 *
 * Features:
 * - Robust DOM selection with fallbacks
 * - Error boundary and recovery
 * - Rate limiting
 * - Retry logic with exponential backoff
 * - Offline queue support
 * - User consent management
 * - Real-time status updates
 */

import {
  SELECTORS,
  EXTRACTION_CONFIG,
  RATE_LIMIT_CONFIG,
  STORAGE_KEYS,
  getConfig,
  type ExtensionMessage,
  type ExtensionResponse,
  type SetAuthTokenMessage,
  type CheckStatusData,
} from "./config";
import { parseWhatsAppMessageMetadata } from "./whatsapp-metadata";
import {
  combineSenderEvidence,
  extractStableWhatsAppConversationId,
} from "./whatsapp-identity";
import { classifyMediaEvidence, type MediaType } from "./media-evidence";
import {
  findConversationRoot,
  findMessageContainers,
  findMessageRecord,
  findMessageText,
} from "./dom-selectors";

// =============================================================================
// Types
// =============================================================================

interface ExtractedMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
  isOutgoing: boolean;
  isMedia: boolean;
  mediaType?: "image" | "video" | "audio" | "document" | "sticker";
  replyTo?: string;
  senderRef?: string;
}

interface ExtractedParticipant {
  ref: string;
  rawDisplayName?: string;
  rawUsername?: string;
  normalizedPhone?: string;
  platformUserId?: string;
  isSelf: boolean;
  extractionMethod:
    | "metadata"
    | "sender-element"
    | "conversation-header"
    | "outgoing"
    | "fallback";
  confidence: "high" | "medium" | "low";
}

type MetadataPath = "container" | "ancestor" | "descendant" | "none";
type TimestampMethod = "metadata" | "visible-time" | "fallback";

interface ExtractionDiagnostics {
  messageContainerCount: number;
  extractedMessageCount: number;
  metadataPathCounts: Record<MetadataPath, number>;
  senderMethodCounts: Record<ExtractedParticipant["extractionMethod"], number>;
  timestampMethodCounts: Record<TimestampMethod, number>;
}

interface ExtractedChat {
  chatName: string;
  chatId: string;
  sourceConversationId?: string;
  extractedAt: string;
  messageCount: number;
  messages: ExtractedMessage[];
  source: "chrome-extension";
  version: string;
  isGroup: boolean;
  payloadVersion: 2;
  participants: ExtractedParticipant[];
  diagnostics: ExtractionDiagnostics;
}

interface ExtractionState {
  isExtracting: boolean;
  lastExtraction: number;
  extractionCount: number;
  rateLimitResetTime: number;
}

// =============================================================================
// State
// =============================================================================

const state: ExtractionState = {
  isExtracting: false,
  lastExtraction: 0,
  extractionCount: 0,
  rateLimitResetTime: 0,
};

let authToken: string | null = null;
let currentChatId: string | null = null;
let statusUI: HTMLElement | null = null;
let chatObserver: MutationObserver | null = null;
let isInitialized = false;
let reviewedCapture: ExtractedChat | null = null;

// =============================================================================
// Initialization
// =============================================================================

async function init(): Promise<void> {
  // Guard against multiple initializations
  if (isInitialized) {
    console.log("[ConvoLens] Already initialized, skipping");
    return;
  }

  console.log("[ConvoLens] Content script initializing...");

  // Verify we're on WhatsApp Web
  if (!window.location.hostname.includes("web.whatsapp.com")) {
    console.log("[ConvoLens] Not on WhatsApp Web, exiting");
    return;
  }

  // Register the receiver before waiting on WhatsApp's frequently changing
  // DOM. The popup must be able to query status immediately after an extension
  // reload, even while the page UI is still settling.
  chrome.runtime.onMessage.addListener(handleMessage);
  isInitialized = true;
  window.addEventListener("beforeunload", cleanup);

  // Wait for WhatsApp to fully load
  await waitForWhatsAppReady();

  // Load saved auth token
  try {
    const stored = await chrome.storage.local.get([STORAGE_KEYS.authToken]);
    authToken = stored[STORAGE_KEYS.authToken];
  } catch (error) {
    console.warn("[ConvoLens] Failed to load auth token:", error);
  }

  // Inject UI elements
  injectUI();

  // Observe chat navigation
  observeChatChanges();

  console.log("[ConvoLens] Content script initialized successfully");
}

/**
 * Cleanup resources when page unloads
 */
function cleanup(): void {
  if (chatObserver) {
    chatObserver.disconnect();
    chatObserver = null;
  }
  chrome.runtime.onMessage.removeListener(handleMessage);
  isInitialized = false;
  console.log("[ConvoLens] Cleanup completed");
}

/**
 * Wait for WhatsApp Web to be fully loaded
 */
async function waitForWhatsAppReady(timeout: number = 30000): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkReady = () => {
      const chatList =
        document.querySelector(SELECTORS.primary.chatList) ||
        document.querySelector(SELECTORS.fallback.chatList);

      if (chatList) {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeout) {
        // WhatsApp might still be loading or user needs to scan QR
        console.warn(
          "[ConvoLens] WhatsApp not fully loaded, will wait for chat selection",
        );
        resolve();
        return;
      }

      setTimeout(checkReady, 500);
    };

    checkReady();
  });
}

// =============================================================================
// UI Injection
// =============================================================================

function injectUI(): void {
  // Remove existing UI if present
  document.getElementById("convolens-fab")?.remove();

  // Create floating action button container
  const fab = document.createElement("div");
  fab.id = "convolens-fab";
  fab.innerHTML = `
    <div id="ws-status" class="ws-status ws-hidden" role="status" aria-live="polite">
      <div class="ws-status-icon"></div>
      <span id="ws-status-text">Ready</span>
    </div>
    <div id="ws-progress" class="ws-progress ws-hidden">
      <div class="ws-progress-bar"></div>
    </div>
    <button id="ws-extract-btn" class="ws-fab-btn" title="Review the messages currently loaded in this chat">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
      <span class="ws-fab-text">Review loaded messages</span>
    </button>
  `;

  document.body.appendChild(fab);
  statusUI = fab;

  // Add event listeners
  document
    .getElementById("ws-extract-btn")
    ?.addEventListener("click", handleExtractClick);
}

function updateStatus(
  message: string,
  type: "info" | "success" | "error" | "loading" = "info",
): void {
  const statusEl = document.getElementById("ws-status");
  const statusText = document.getElementById("ws-status-text");
  const statusIcon = statusEl?.querySelector(".ws-status-icon") as HTMLElement;

  if (!statusEl || !statusText) return;

  statusEl.classList.remove("ws-hidden");
  statusText.textContent = message;

  // Reset classes
  statusEl.className = "ws-status";
  statusEl.classList.add(`ws-status-${type}`);

  // Update icon
  if (statusIcon) {
    statusIcon.className = "ws-status-icon";
    if (type === "loading") {
      statusIcon.classList.add("ws-spinner");
    }
  }

  // Auto-hide after delay (except for loading)
  if (type !== "loading") {
    setTimeout(() => {
      statusEl.classList.add("ws-hidden");
    }, 3000);
  }
}

function updateProgress(percent: number): void {
  const progressEl = document.getElementById("ws-progress");
  const progressBar = progressEl?.querySelector(
    ".ws-progress-bar",
  ) as HTMLElement;

  if (!progressEl || !progressBar) return;

  if (percent > 0 && percent < 100) {
    progressEl.classList.remove("ws-hidden");
    progressBar.style.width = `${percent}%`;
  } else {
    progressEl.classList.add("ws-hidden");
    progressBar.style.width = "0%";
  }
}

// =============================================================================
// Extraction Logic
// =============================================================================

async function handleExtractClick(): Promise<void> {
  // Check rate limiting
  if (!checkRateLimit()) {
    const waitTime = Math.ceil((state.rateLimitResetTime - Date.now()) / 1000);
    updateStatus(`Please wait ${waitTime}s before reviewing again`, "error");
    updateProgress(0);
    return;
  }

  // Prevent concurrent extractions
  if (state.isExtracting) {
    updateStatus("A loaded-message review is already in progress", "info");
    return;
  }

  state.isExtracting = true;
  updateStatus("Reading loaded messages…", "loading");
  updateProgress(10);

  try {
    const chatData = await extractCurrentChatWithRetry();

    if (!chatData || chatData.messages.length === 0) {
      updateStatus("No readable loaded messages found", "error");
      return;
    }

    updateProgress(60);
    reviewedCapture = chatData;

    const confirmed = window.confirm(
      `Send ${chatData.messages.length} loaded message${chatData.messages.length === 1 ? "" : "s"} from “${chatData.chatName}” to ConvoLens?\n\nOlder messages that WhatsApp has not loaded are excluded. Capture as I scroll and automatic older-message loading are coming soon.`,
    );

    if (!confirmed) {
      reviewedCapture = null;
      updateStatus("Upload cancelled. Nothing was sent.", "info");
      return;
    }

    updateStatus(
      `Sending ${chatData.messages.length} loaded messages…`,
      "loading",
    );

    // Send to background script
    const response = await chrome.runtime.sendMessage({
      action: "SEND_CHAT_DATA",
      data: chatData,
    });

    updateProgress(100);

    if (response.success) {
      reviewedCapture = null;
      const reconciliationRequired = Boolean(
        response.data?.reconciliationRequired,
      );
      updateStatus(
        reconciliationRequired
          ? `${chatData.messages.length} loaded messages stored separately. Review the possible prior intake in ConvoLens.`
          : `${chatData.messages.length} loaded messages received by ConvoLens`,
        "success",
      );
      state.lastExtraction = Date.now();
      state.extractionCount++;

      // Optionally open dashboard
      if (response.data?.openDashboard) {
        try {
          await chrome.runtime.sendMessage({ action: "OPEN_DASHBOARD" });
        } catch {
          // The service worker can disappear after the upload has succeeded.
        }
      }
    } else {
      updateStatus(
        response.retryRequired
          ? "Upload not sent. Review the loaded messages and try again from this tab."
          : response.error || "Failed to send loaded messages",
        "error",
      );
    }
  } catch (error) {
    updateStatus(normalizeErrorMessage(error), "error");
  } finally {
    state.isExtracting = false;
    updateProgress(0);
  }
}

/**
 * Extract with retry logic
 */
async function extractCurrentChatWithRetry(
  attempts: number = EXTRACTION_CONFIG.retryAttempts,
  silent: boolean = false,
): Promise<ExtractedChat | null> {
  let lastError: Error | null = null;

  for (let i = 0; i < attempts; i++) {
    try {
      return await extractCurrentChat(silent);
    } catch (error) {
      lastError = error as Error;
      console.warn(`[ConvoLens] Extraction attempt ${i + 1} failed:`, error);

      if (i < attempts - 1) {
        const delay = EXTRACTION_CONFIG.retryDelayMs * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Extraction failed after all attempts");
}

/**
 * Extract messages from the current chat
 */
async function extractCurrentChat(
  silent: boolean = false,
): Promise<ExtractedChat> {
  // Get chat name
  const chatHeader = querySelector(
    SELECTORS.primary.contactName,
    SELECTORS.fallback.contactName,
  );
  const chatName = chatHeader?.textContent?.trim() || "Unknown Chat";

  // Detect if this is a group chat
  const isGroup = detectGroupChat();
  const isDirectChat = detectDirectChat();

  // Get message container
  const messageList = findConversationRoot(
    document,
    SELECTORS.primary.messageList,
    SELECTORS.fallback.messageList,
  );
  if (!messageList) {
    throw new Error("Could not find message list. Please open a chat first.");
  }

  // Scroll to load more messages if needed (optional - can be slow)
  // await scrollToLoadMessages(messageList);

  // Extract messages
  const messageContainers = findMessageContainers(
    messageList,
    SELECTORS.primary.messageContainer,
    SELECTORS.fallback.messageContainer,
  );

  const messages: ExtractedMessage[] = [];
  const participants: ExtractedParticipant[] = [];
  const participantRefs = new Map<string, string>();
  const totalMessages = messageContainers.length;
  const diagnostics = createExtractionDiagnostics(totalMessages);
  const sourceConversationId = extractStableWhatsAppConversationId([
    messageList.getAttribute("data-chat-id"),
    messageList.getAttribute("data-jid"),
    messageList.closest("[data-chat-id]")?.getAttribute("data-chat-id"),
    messageList.closest("[data-jid]")?.getAttribute("data-jid"),
    ...messageContainers
      .slice(0, 20)
      .map((container) => container.getAttribute("data-id")),
  ]);

  for (let i = 0; i < messageContainers.length; i++) {
    // Update progress
    if (!silent && i % 10 === 0) {
      updateProgress(10 + (i / totalMessages) * 50);
    }

    // Small delay to avoid browser freeze
    if (i % 50 === 0 && i > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, EXTRACTION_CONFIG.extractionDelayMs),
      );
    }

    try {
      const message = extractMessageData(
        messageContainers[i] as HTMLElement,
        isDirectChat,
        chatName,
        participants,
        participantRefs,
        diagnostics,
      );
      if (message) {
        messages.push(message);
      }
    } catch (error) {
      console.warn("[ConvoLens] Failed to extract message:", error);
    }

    // Check batch limit
    if (messages.length >= EXTRACTION_CONFIG.maxMessagesPerBatch) {
      console.log("[ConvoLens] Reached batch limit");
      break;
    }
  }

  return {
    chatName,
    chatId: generateChatId(chatName),
    sourceConversationId,
    extractedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages,
    source: "chrome-extension",
    version: chrome.runtime.getManifest().version,
    isGroup,
    payloadVersion: 2,
    participants,
    diagnostics,
  };
}

/**
 * Extract data from a single message element
 */
function extractMessageData(
  container: HTMLElement,
  isDirectChat: boolean,
  chatName: string,
  participants: ExtractedParticipant[],
  participantRefs: Map<string, string>,
  diagnostics: ExtractionDiagnostics,
): ExtractedMessage | null {
  const messageRecord = findMessageRecord(container);

  // Get message text
  const textEl = findMessageText(
    messageRecord,
    SELECTORS.primary.messageText,
    SELECTORS.fallback.messageText,
  );

  const text = textEl?.textContent?.trim() || "";

  // Check for media messages
  const isMedia = detectMediaMessage(messageRecord);
  const mediaType = isMedia ? getMediaType(messageRecord) : undefined;

  // Skip if no text and no media
  if (!text && !isMedia) return null;

  // Get timestamp
  const timeEl =
    messageRecord.querySelector(SELECTORS.primary.messageTime) ||
    messageRecord.querySelector(SELECTORS.fallback.messageTime);
  const timeText = timeEl?.textContent?.trim() || "";

  // Get sender (for group chats)
  const senderEl =
    messageRecord.querySelector(SELECTORS.primary.senderName) ||
    messageRecord.querySelector(SELECTORS.fallback.senderName);

  // Determine direction
  const isOutgoing =
    container.classList.contains("message-out") ||
    container.closest('[data-testid="msg-out"]') !== null ||
    messageRecord.classList.contains("message-out") ||
    messageRecord.closest('[data-testid="msg-out"]') !== null ||
    messageRecord.querySelector('[data-testid="msg-out"]') !== null;
  const metadata = getMessageMetadata(messageRecord);
  const identity = extractSenderIdentity(
    messageRecord,
    senderEl,
    isOutgoing,
    isDirectChat,
    chatName,
    metadata.value,
  );
  const { displayLabel, ...participantIdentity } = identity;
  const senderRef = registerParticipant(
    participantIdentity,
    participants,
    participantRefs,
  );
  const timestamp = parseTimestamp(timeText, metadata.value);

  diagnostics.extractedMessageCount += 1;
  diagnostics.metadataPathCounts[metadata.path] += 1;
  diagnostics.senderMethodCounts[participantIdentity.extractionMethod] += 1;
  diagnostics.timestampMethodCounts[timestamp.method] += 1;

  return {
    id: generateMessageId(),
    text,
    sender:
      displayLabel || `Unidentified participant ${participants.length || 1}`,
    timestamp: timestamp.value,
    isOutgoing,
    isMedia,
    mediaType,
    senderRef,
  };
}

function extractSenderIdentity(
  container: HTMLElement,
  senderEl: Element | null,
  isOutgoing: boolean,
  isDirectChat: boolean,
  chatName: string,
  metadata: string,
): Omit<ExtractedParticipant, "ref"> & { displayLabel?: string } {
  if (isOutgoing) {
    return {
      rawDisplayName: "You",
      displayLabel: "You",
      isSelf: true,
      extractionMethod: "outgoing",
      confidence: "high",
    };
  }
  const metadataSender = parseWhatsAppMessageMetadata(
    metadata,
    document.documentElement.lang || navigator.language,
  ).sender;
  const explicitSender = senderEl?.textContent?.trim();
  // A failure to recognise a group is not proof this is a direct chat.
  const headerSender = isDirectChat
    ? querySelector(
        SELECTORS.primary.contactName,
        SELECTORS.fallback.contactName,
      )?.textContent?.trim() ||
      (chatName === "Unknown Chat" ? undefined : chatName)
    : undefined;
  const scopedPhoneEvidence = [
    senderEl?.getAttribute("data-phone"),
    senderEl?.getAttribute("title"),
    senderEl?.closest("[data-contact-id]")?.getAttribute("data-contact-id"),
  ].filter((value): value is string => Boolean(value));
  const combined = combineSenderEvidence({
    metadataSender,
    visibleSender: explicitSender,
    headerSender,
    scopedPhoneEvidence,
  });
  const rawDisplayName = combined.rawDisplayName;
  const rawUsername = rawDisplayName?.match(/^@[^\s]+$/)?.[0];
  // WhatsApp commonly renders the phone alongside the sender label. It is
  // capture-scoped evidence, never a contact-book scrape.
  const normalizedPhone = combined.normalizedPhone;
  // data-id identifies an individual message in WhatsApp Web, not its sender.
  const platformUserId =
    container.getAttribute("data-contact-id") ||
    container.closest("[data-contact-id]")?.getAttribute("data-contact-id") ||
    undefined;
  const extractionMethod = metadataSender
    ? "metadata"
    : explicitSender
      ? "sender-element"
      : headerSender
        ? "conversation-header"
        : "fallback";
  return {
    rawDisplayName,
    displayLabel: combined.displayLabel,
    rawUsername,
    normalizedPhone,
    platformUserId,
    isSelf: false,
    extractionMethod,
    confidence:
      extractionMethod === "metadata"
        ? "high"
        : extractionMethod === "fallback"
          ? "low"
          : "medium",
  };
}

function getMessageMetadata(container: HTMLElement): {
  value: string;
  path: MetadataPath;
} {
  const containerMetadata = container.getAttribute("data-pre-plain-text");
  if (containerMetadata) return { value: containerMetadata, path: "container" };

  const ancestorMetadata = container
    .closest("[data-pre-plain-text]")
    ?.getAttribute("data-pre-plain-text");
  if (ancestorMetadata) return { value: ancestorMetadata, path: "ancestor" };

  const descendantMetadata = container
    .querySelector("[data-pre-plain-text]")
    ?.getAttribute("data-pre-plain-text");
  if (descendantMetadata)
    return { value: descendantMetadata, path: "descendant" };

  return { value: "", path: "none" };
}

function registerParticipant(
  identity: Omit<ExtractedParticipant, "ref">,
  participants: ExtractedParticipant[],
  participantRefs: Map<string, string>,
): string {
  const stableKey = identity.isSelf
    ? "self"
    : identity.platformUserId ||
      identity.normalizedPhone ||
      identity.rawUsername ||
      identity.rawDisplayName ||
      `unidentified-${participants.length + 1}`;
  const existing = participantRefs.get(stableKey);
  if (existing) return existing;
  const ref = `participant_${participants.length + 1}`;
  participants.push({ ref, ...identity });
  participantRefs.set(stableKey, ref);
  return ref;
}

// =============================================================================
// Helper Functions
// =============================================================================

function querySelector(primary: string, fallback: string): Element | null {
  return document.querySelector(primary) || document.querySelector(fallback);
}

function detectGroupChat(): boolean {
  // Groups have participant counts or multiple sender names visible
  const participantInfo = document.querySelector(
    '[data-testid="conversation-subtitle"]',
  );
  const text = participantInfo?.textContent || "";
  return text.includes("participant") || text.includes("members");
}

function detectDirectChat(): boolean {
  const subtitle =
    document
      .querySelector('[data-testid="conversation-subtitle"]')
      ?.textContent?.trim()
      .toLowerCase() || "";
  // These are direct-chat-only states in WhatsApp Web. Do not infer a direct
  // chat merely because the group detector did not recognise localized UI.
  return /\bonline\b|\btyping\b|last seen|disappearing messages/.test(subtitle);
}

function detectMediaMessage(container: HTMLElement): boolean {
  if (getMediaType(container)) return true;
  const mediaIndicators = ['[data-testid="media-state-icon"]'];

  return mediaIndicators.some(
    (selector) => container.querySelector(selector) !== null,
  );
}

function getMediaType(container: HTMLElement): MediaType | undefined {
  return classifyMediaEvidence({
    video:
      container.querySelector(
        'video, [data-testid="video-thumb"], .message-video',
      ) !== null,
    audio:
      container.querySelector(
        'audio, [data-testid="audio-player"], .message-audio',
      ) !== null,
    document:
      container.querySelector(
        '[data-testid="document-thumb"], .message-document',
      ) !== null,
    sticker: container.querySelector('[data-testid="sticker"]') !== null,
    image:
      container.querySelector('[data-testid="image-thumb"], .message-image') !==
      null,
  });
}

function parseTimestamp(
  timeText: string,
  metadata: string = "",
): { value: string; method: TimestampMethod } {
  const now = new Date();

  const metadataTimestamp = parseWhatsAppMessageMetadata(
    metadata,
    document.documentElement.lang || navigator.language,
  ).timestamp;
  if (metadataTimestamp)
    return { value: metadataTimestamp, method: "metadata" };

  if (!timeText) return { value: now.toISOString(), method: "fallback" };

  // Handle "HH:MM AM/PM" format
  if (timeText.match(/^\d{1,2}:\d{2}\s*(AM|PM)?$/i)) {
    const match = timeText.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const period = match[3]?.toUpperCase();

      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      now.setHours(hours, minutes, 0, 0);
      return { value: now.toISOString(), method: "visible-time" };
    }
  }

  // Handle "Yesterday" format
  if (timeText.toLowerCase().includes("yesterday")) {
    now.setDate(now.getDate() - 1);
    return { value: now.toISOString(), method: "visible-time" };
  }

  // Try parsing as date
  try {
    return { value: new Date(timeText).toISOString(), method: "visible-time" };
  } catch {
    return { value: now.toISOString(), method: "fallback" };
  }
}

function createExtractionDiagnostics(
  messageContainerCount: number,
): ExtractionDiagnostics {
  return {
    messageContainerCount,
    extractedMessageCount: 0,
    metadataPathCounts: { container: 0, ancestor: 0, descendant: 0, none: 0 },
    senderMethodCounts: {
      metadata: 0,
      "sender-element": 0,
      "conversation-header": 0,
      outgoing: 0,
      fallback: 0,
    },
    timestampMethodCounts: { metadata: 0, "visible-time": 0, fallback: 0 },
  };
}

function generateMessageId(): string {
  // Use crypto.getRandomValues() for cryptographically secure random values
  const randomBytes = new Uint8Array(5);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return "msg_" + Date.now().toString(36) + randomHex;
}

function generateChatId(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .slice(0, 50);
  return "chat_" + sanitized + "_" + Date.now().toString(36);
}

// =============================================================================
// Rate Limiting
// =============================================================================

function checkRateLimit(): boolean {
  const now = Date.now();

  // Reset counter if window has passed
  if (now > state.rateLimitResetTime) {
    state.extractionCount = 0;
    state.rateLimitResetTime = now + 60000; // 1 minute window
  }

  // Check if within limits
  if (state.extractionCount >= RATE_LIMIT_CONFIG.maxExtractionsPerMinute) {
    return false;
  }

  return true;
}

// =============================================================================
// Chat Navigation Observer
// =============================================================================

function observeChatChanges(): void {
  // Disconnect existing observer if any
  if (chatObserver) {
    chatObserver.disconnect();
  }

  chatObserver = new MutationObserver(() => {
    const header = querySelector(
      SELECTORS.primary.chatHeader,
      SELECTORS.fallback.chatHeader,
    );
    if (header) {
      const contactName = querySelector(
        SELECTORS.primary.contactName,
        SELECTORS.fallback.contactName,
      );
      const newChatId = generateChatId(contactName?.textContent || "");

      if (newChatId !== currentChatId) {
        currentChatId = newChatId;
        console.log("[ConvoLens] Chat changed");
      }
    }
  });

  // Find a more specific target than document.body to reduce performance impact
  const chatContainer =
    document.querySelector("#main") ||
    document.querySelector('[data-testid="conversation-panel-wrapper"]') ||
    document.body;

  chatObserver.observe(chatContainer, {
    childList: true,
    subtree: true,
    // Don't observe attribute changes - reduces noise
    attributes: false,
    characterData: false,
  });

  console.log(
    "[ConvoLens] Chat observer started on:",
    chatContainer.tagName || "body",
  );
}

// =============================================================================
// Message Handler
// =============================================================================

function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: ExtensionResponse) => void,
): boolean {
  switch (message.action) {
    case "GET_CURRENT_CHAT":
      extractCurrentChatWithRetry(EXTRACTION_CONFIG.retryAttempts, true)
        .then((data) => {
          reviewedCapture = data;
          respondSafely(sendResponse, { success: true, data });
        })
        .catch((error) =>
          respondSafely(sendResponse, {
            success: false,
            error: normalizeErrorMessage(error),
          }),
        );
      return true;

    case "CHECK_STATUS": {
      const chatList = querySelector(
        SELECTORS.primary.chatList,
        SELECTORS.fallback.chatList,
      );
      const statusData: CheckStatusData = {
        isWhatsAppWeb: true,
        isLoggedIn: !!chatList,
        isExtracting: state.isExtracting,
      };
      sendResponse({ success: true, data: statusData });
      break;
    }

    case "SET_AUTH_TOKEN": {
      const typedMessage = message as SetAuthTokenMessage;
      // Validate token is string or null
      if (
        typedMessage.token !== null &&
        typeof typedMessage.token !== "string"
      ) {
        sendResponse({
          success: false,
          error: "Token must be a string or null",
        });
        break;
      }
      authToken = typedMessage.token;
      chrome.storage.local
        .set({ [STORAGE_KEYS.authToken]: typedMessage.token })
        .catch(() => undefined);
      sendResponse({ success: true });
      break;
    }

    default:
      sendResponse({ success: false, error: "Unknown action" });
  }

  return false;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "The extension could not complete this operation.";
}

function respondSafely(
  sendResponse: (response: ExtensionResponse) => void,
  response: ExtensionResponse,
): void {
  try {
    sendResponse(response);
  } catch {
    // The popup or tab can close while extraction is still completing.
  }
}

// =============================================================================
// Initialize
// =============================================================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
