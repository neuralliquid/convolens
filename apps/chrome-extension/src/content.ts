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
  type AuthStatusData,
} from "./config";
import type {
  AutomaticCaptureBoundary,
  CaptureCollectionSummary,
  CaptureOperationSnapshot,
  CaptureOperationState,
  CaptureStopReason,
} from "./capture-operation";
import {
  AUTOMATIC_CAPTURE_SAFETY_CAP,
  AUTOMATIC_NO_PROGRESS_LIMIT,
  automaticBoundaryStopReason,
  automaticDateBoundaryStartIndex,
  normalizeAutomaticBoundary,
} from "./automatic-capture";
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
import {
  DEFAULT_LAUNCHER_POSITION,
  getLauncherTop,
  normalizeLauncherPosition,
  resolveLauncherEdge,
  resolveLauncherPreset,
  type LauncherPosition,
  type LauncherPreset,
} from "./launcher-position";
import {
  mergeGuidedWindow,
  resolveDisjointGuidedEdge,
  type GuidedMergeEdge,
  type GuidedWindowItem,
} from "./guided-capture";

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
  captureSourceId?: string;
  captureAlignmentToken?: string;
  captureMetadataPath?: MetadataPath;
  captureSenderMethod?: ExtractedParticipant["extractionMethod"];
  captureTimestampMethod?: TimestampMethod;
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
  unreadableMessageCount: number;
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

interface CapturePreviewSummary {
  chatName: string;
  loadedMessageCount: number;
  oldestTimestamp?: string;
  oldestTrustedTimestamp?: string;
  newestTimestamp?: string;
  participantLabelCount: number;
  mediaCount: number;
  skippedCount: number;
  unreadableCount: number;
  alignmentWarningCount: number;
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
let chatObserver: MutationObserver | null = null;
let isInitialized = false;
interface ActiveCaptureOperation {
  operationId: string;
  chatIdentity: string;
  state: CaptureOperationState;
  payload: ExtractedChat | null;
  alignmentWarningCount?: number;
}

interface GuidedCaptureSession {
  operationId: string;
  chatIdentity: string;
  payload: ExtractedChat;
  mode: "guided" | "automatic";
  captureLimit: number;
  items: GuidedWindowItem<ExtractedMessage>[];
  observer: MutationObserver;
  scrollTarget: HTMLElement;
  timeoutId?: number;
  consecutiveFailures: number;
  alignmentWarningCount: number;
  alignmentWarnings: GuidedWindowItem<ExtractedMessage>[][];
  skippedCount: number;
  unreadableCount: number;
  reading: boolean;
  pendingWindows: Promise<ExtractedChat | null>[];
  drainPromise?: Promise<void>;
  pendingStopReason?: Exclude<CaptureStopReason, "loaded-window">;
  finalizing: boolean;
  limitReached: boolean;
  automaticBoundary?: AutomaticCaptureBoundary;
  automaticStartedAt?: Date;
  automaticPaused: boolean;
  automaticRunner?: Promise<void>;
  originalScrollTop?: number;
  originalBottomOffset?: number;
  noProgressCount: number;
  observedWindowCount: number;
}

const GUIDED_CAPTURE_LIMIT = 2_000;
const GUIDED_CAPTURE_TIMEOUT_MS = 10 * 60 * 1_000;
const AUTOMATIC_STABILIZATION_TIMEOUT_MS = 3_000;
const AUTOMATIC_STABILIZATION_INTERVAL_MS = 120;

let activeCaptureOperation: ActiveCaptureOperation | null = null;
let guidedCaptureSession: GuidedCaptureSession | null = null;
let pageConfirmationOperationId: string | null = null;
let pageConfirmationPromise: Promise<void> | null = null;
let lastCountedTerminalOperationId: string | null = null;
const chatIdentityTokens = new Map<string, string>();
let launcherPosition: LauncherPosition = DEFAULT_LAUNCHER_POSITION;
let launcherOperation: CaptureOperationSnapshot | null = null;
let legacyQueueCount = 0;
let launcherSuppressClick = false;
let launcherAuthRefreshGeneration = 0;
let launcherOperationRenderGeneration = 0;
let launcherModeChangeGeneration = 0;
let launcherCaptureAuthGeneration = 0;

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

  // Inject UI elements
  await injectUI();
  await refreshLauncherFromValidatedAuthentication().catch(() => undefined);
  window.addEventListener("resize", handleViewportResize);

  // Observe chat navigation
  observeChatChanges();

  console.log("[ConvoLens] Content script initialized successfully");
}

/**
 * Cleanup resources when page unloads
 */
function cleanup(): void {
  const operation = activeCaptureOperation;
  if (operation && operation.state !== "uploading") {
    sendRuntimeLifecycleMessage({
      action: "CANCEL_CAPTURE_OPERATION",
      operationId: operation.operationId,
      reason: "The WhatsApp tab unloaded during capture.",
    });
  }
  if (guidedCaptureSession) {
    teardownGuidedCaptureSession(guidedCaptureSession.operationId);
  }
  activeCaptureOperation = null;
  if (chatObserver) {
    chatObserver.disconnect();
    chatObserver = null;
  }
  chrome.runtime.onMessage.removeListener(handleMessage);
  window.removeEventListener("resize", handleViewportResize);
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

async function injectUI(): Promise<void> {
  // Remove existing UI if present
  document.getElementById("convolens-fab")?.remove();

  let stored: Record<string, any> = {};
  try {
    stored = await chrome.storage.local.get([STORAGE_KEYS.launcherPosition]);
  } catch {
    // Default placement and an empty migration count remain safe fallbacks.
  }
  launcherPosition = normalizeLauncherPosition(
    stored[STORAGE_KEYS.launcherPosition],
  );

  // Create the compact launcher and its inward-opening workflow panel.
  const fab = document.createElement("div");
  fab.id = "convolens-fab";
  fab.className = "ws-launcher";
  fab.innerHTML = `
    <section id="ws-launcher-panel" class="ws-launcher-panel" aria-label="ConvoLens capture" hidden>
      <header class="ws-launcher-header">
        <div>
          <strong>ConvoLens capture</strong>
          <span>WhatsApp messages currently loaded</span>
        </div>
        <button id="ws-launcher-close" class="ws-icon-btn" type="button" aria-label="Close ConvoLens capture panel">×</button>
      </header>
      <div id="ws-status" class="ws-status ws-status-info" role="status" aria-live="polite">
        <div class="ws-status-icon"></div>
        <span id="ws-status-text">Sign in to ConvoLens before reviewing loaded messages.</span>
      </div>
      <div id="ws-progress" class="ws-progress ws-hidden" aria-hidden="true">
        <div class="ws-progress-bar"></div>
      </div>
      <fieldset class="ws-capture-modes">
        <legend>Capture mode</legend>
        <label class="ws-capture-mode ws-capture-mode-selected">
          <input type="radio" name="ws-capture-mode" value="loaded" checked>
          <span><strong>Loaded messages</strong><small>Review what WhatsApp has loaded now</small></span>
          <em>Selected</em>
        </label>
        <label class="ws-capture-mode">
          <input type="radio" name="ws-capture-mode" value="scroll">
          <span><strong>Capture as I scroll</strong><small>Guided collection while you scroll</small></span>
          <em>Available</em>
        </label>
        <label class="ws-capture-mode">
          <input type="radio" name="ws-capture-mode" value="automatic">
          <span><strong>Load older messages for me</strong><small>Automatic older-history loading</small></span>
          <em>Available</em>
        </label>
      </fieldset>
      <div id="ws-automatic-options" class="ws-automatic-options" hidden>
        <label for="ws-automatic-boundary"><strong>Stop boundary</strong></label>
        <select id="ws-automatic-boundary">
          <option value="days-7">Last 7 days</option>
          <option value="days-30">Last 30 days</option>
          <option value="messages-100">100 messages</option>
          <option value="messages-250">250 messages</option>
          <option value="messages-500">500 messages (safety cap)</option>
          <option value="verified-top">Verified top of history</option>
        </select>
        <label class="ws-automatic-consent">
          <input id="ws-automatic-consent" type="checkbox">
          <span>I understand WhatsApp will scroll this chat. I can pause, stop and review, or cancel.</span>
        </label>
      </div>
      <button id="ws-extract-btn" class="ws-capture-btn" type="button" disabled>
        Sign in to capture
      </button>
      <section id="ws-guided-progress" class="ws-guided-progress" aria-live="polite" hidden>
        <strong id="ws-collection-title">Guided capture is active</strong>
        <span id="ws-collection-instruction">Scroll upward in this chat. ConvoLens will retain each message window before WhatsApp removes it.</span>
        <p><b id="ws-guided-count">0</b> unique messages · oldest <span id="ws-guided-oldest">Not detected</span></p>
        <p id="ws-guided-warning" class="ws-guided-warning" hidden></p>
        <div class="ws-preview-actions">
          <button id="ws-pause-automatic" class="ws-secondary-btn" type="button" hidden>Pause</button>
          <button id="ws-stop-guided" class="ws-capture-btn" type="button">Stop and review</button>
          <button id="ws-cancel-guided" class="ws-secondary-btn" type="button">Cancel</button>
        </div>
      </section>
      <section id="ws-capture-review" class="ws-capture-review" aria-labelledby="ws-capture-review-title" hidden>
        <h3 id="ws-capture-review-title">Review before upload</h3>
        <strong id="ws-preview-chat-name" class="ws-preview-chat-name"></strong>
        <dl class="ws-preview-grid">
          <div><dt id="ws-preview-count-label">Loaded messages</dt><dd id="ws-preview-loaded">0</dd></div>
          <div><dt>Participant labels</dt><dd id="ws-preview-participants">0</dd></div>
          <div><dt>Media</dt><dd id="ws-preview-media">0</dd></div>
          <div><dt>Skipped</dt><dd id="ws-preview-skipped">0</dd></div>
          <div><dt>Unreadable</dt><dd id="ws-preview-unreadable">0</dd></div>
        </dl>
        <p id="ws-preview-range" class="ws-preview-range"></p>
        <p id="ws-preview-warning" class="ws-guided-warning" hidden></p>
        <p id="ws-scope-copy" class="ws-scope-copy">Only the loaded messages counted above will be uploaded. Older messages WhatsApp has not loaded are excluded. Nothing is sent until you confirm.</p>
        <div class="ws-preview-actions">
          <button id="ws-confirm-capture" class="ws-capture-btn" type="button">Confirm upload</button>
          <button id="ws-cancel-capture" class="ws-secondary-btn" type="button">Cancel</button>
        </div>
      </section>
      <div id="ws-legacy-attention" class="ws-legacy-attention" hidden>
        <strong>Legacy local captures need review</strong>
        <span id="ws-legacy-count"></span>
        <button id="ws-open-settings" class="ws-link-btn" type="button">Open migration settings</button>
      </div>
      <div class="ws-position-controls" aria-label="Launcher position">
        <span>Position</span>
        <div role="group" aria-label="Vertical launcher position">
          <button type="button" data-launcher-preset="upper">Top</button>
          <button type="button" data-launcher-preset="middle">Middle</button>
          <button type="button" data-launcher-preset="lower">Bottom</button>
        </div>
        <button id="ws-launcher-side" class="ws-link-btn" type="button"></button>
      </div>
    </section>
    <button id="ws-launcher-toggle" class="ws-launcher-toggle" type="button" aria-expanded="false" aria-controls="ws-launcher-panel" aria-label="Open ConvoLens capture panel. Drag to move.">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
      <span id="ws-launcher-badge" class="ws-launcher-badge" aria-hidden="true"></span>
    </button>
  `;

  document.body.appendChild(fab);
  applyLauncherPosition();
  setupLauncherInteraction();

  document
    .getElementById("ws-extract-btn")
    ?.addEventListener("click", handleExtractClick);
  document
    .getElementById("ws-confirm-capture")
    ?.addEventListener("click", () => {
      if (launcherOperation) void reviewPageCapture(launcherOperation, true);
    });
  document
    .getElementById("ws-cancel-capture")
    ?.addEventListener("click", () => {
      if (launcherOperation) void reviewPageCapture(launcherOperation, false);
    });
  document.getElementById("ws-stop-guided")?.addEventListener("click", () => {
    if (launcherOperation) void stopPageCollection(launcherOperation);
  });
  document
    .getElementById("ws-pause-automatic")
    ?.addEventListener("click", () => {
      if (launcherOperation) void togglePageAutomaticCapture(launcherOperation);
    });
  document.getElementById("ws-cancel-guided")?.addEventListener("click", () => {
    if (launcherOperation) void reviewPageCapture(launcherOperation, false);
  });
  fab
    .querySelectorAll<HTMLInputElement>('input[name="ws-capture-mode"]')
    .forEach((input) =>
      input.addEventListener("change", handleCaptureModeChange),
    );
  document
    .getElementById("ws-launcher-close")
    ?.addEventListener("click", () => {
      setLauncherExpanded(false, true);
    });
  document.getElementById("ws-open-settings")?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage(() => {
      if (chrome.runtime.lastError) {
        updateStatus(
          "Open extension settings to review legacy captures.",
          "error",
        );
      }
    });
  });
}

function setupLauncherInteraction(): void {
  const fab = document.getElementById("convolens-fab");
  const toggle = document.getElementById(
    "ws-launcher-toggle",
  ) as HTMLButtonElement | null;
  if (!fab || !toggle) return;

  toggle.addEventListener("click", () => {
    if (launcherSuppressClick) {
      launcherSuppressClick = false;
      return;
    }
    setLauncherExpanded(toggle.getAttribute("aria-expanded") !== "true");
  });
  toggle.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setLauncherExpanded(false);
  });

  let drag:
    | { pointerId: number; startX: number; startY: number; startTop: number }
    | undefined;
  toggle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTop: fab.getBoundingClientRect().top,
    };
    toggle.setPointerCapture(event.pointerId);
  });
  toggle.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    );
    if (moved < 5 && !launcherSuppressClick) return;
    launcherSuppressClick = true;
    setLauncherExpanded(false);
    const top = Math.max(
      12,
      Math.min(
        window.innerHeight - 56,
        drag.startTop + event.clientY - drag.startY,
      ),
    );
    fab.style.top = `${top}px`;
    fab.classList.toggle("ws-edge-left", event.clientX < window.innerWidth / 2);
    fab.classList.toggle(
      "ws-edge-right",
      event.clientX >= window.innerWidth / 2,
    );
  });
  const finishDrag = (event: PointerEvent, cancelled = false) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (toggle.hasPointerCapture(event.pointerId)) {
      toggle.releasePointerCapture(event.pointerId);
    }
    if (cancelled) {
      drag = undefined;
      launcherSuppressClick = false;
      applyLauncherPosition();
      return;
    }
    if (launcherSuppressClick) {
      const rect = fab.getBoundingClientRect();
      void setLauncherPosition({
        edge: resolveLauncherEdge(event.clientX, window.innerWidth),
        preset: resolveLauncherPreset(
          rect.top + rect.height / 2,
          window.innerHeight,
        ),
      });
    }
    drag = undefined;
  };
  toggle.addEventListener("pointerup", (event) => finishDrag(event));
  toggle.addEventListener("pointercancel", (event) => finishDrag(event, true));

  fab
    .querySelectorAll<HTMLButtonElement>("[data-launcher-preset]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        void setLauncherPosition({
          ...launcherPosition,
          preset: button.dataset.launcherPreset as LauncherPreset,
        });
      });
    });
  document.getElementById("ws-launcher-side")?.addEventListener("click", () => {
    void setLauncherPosition({
      ...launcherPosition,
      edge: launcherPosition.edge === "right" ? "left" : "right",
    });
  });
  fab.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setLauncherExpanded(false, true);
  });
}

function setLauncherExpanded(expanded: boolean, restoreFocus = false): void {
  const panel = document.getElementById("ws-launcher-panel") as HTMLElement;
  const toggle = document.getElementById(
    "ws-launcher-toggle",
  ) as HTMLButtonElement;
  if (!panel || !toggle) return;
  panel.hidden = !expanded;
  toggle.setAttribute("aria-expanded", String(expanded));
  updateLauncherToggleLabel();
  if (expanded) {
    panel.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
  }
  if (restoreFocus) toggle.focus();
}

async function setLauncherPosition(position: LauncherPosition): Promise<void> {
  launcherPosition = normalizeLauncherPosition(position);
  applyLauncherPosition();
  await chrome.storage.local
    .set({ [STORAGE_KEYS.launcherPosition]: launcherPosition })
    .catch(() => undefined);
}

function applyLauncherPosition(): void {
  const fab = document.getElementById("convolens-fab");
  if (!fab) return;
  fab.classList.toggle("ws-edge-left", launcherPosition.edge === "left");
  fab.classList.toggle("ws-edge-right", launcherPosition.edge === "right");
  fab.dataset.preset = launcherPosition.preset;
  fab.style.top = `${getLauncherTop(launcherPosition.preset, window.innerHeight)}px`;
  fab
    .querySelectorAll<HTMLButtonElement>("[data-launcher-preset]")
    .forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.launcherPreset === launcherPosition.preset),
      );
    });
  const side = document.getElementById("ws-launcher-side");
  if (side) {
    side.textContent = `Move to ${launcherPosition.edge === "right" ? "left" : "right"} edge`;
  }
}

function handleViewportResize(): void {
  applyLauncherPosition();
}

function updateLegacyQueueState(count: number): void {
  legacyQueueCount = count;
  const notice = document.getElementById("ws-legacy-attention");
  const label = document.getElementById("ws-legacy-count");
  if (notice) notice.hidden = count === 0;
  if (label) {
    label.textContent = `${count} unowned local capture${count === 1 ? "" : "s"}. Export or confirmed deletion only.`;
  }
  updateLauncherBadge(launcherOperation);
}

function resetLauncherAccountState(authenticated: boolean): void {
  launcherOperationRenderGeneration += 1;
  launcherOperation = null;
  pageConfirmationOperationId = null;
  const review = document.getElementById("ws-capture-review");
  if (review) review.hidden = true;
  updateLegacyQueueState(0);
  updateProgress(0);
  updateStatus(
    authenticated
      ? "Ready to review loaded messages."
      : "Sign in to ConvoLens before reviewing loaded messages.",
    "info",
  );
  const button = document.getElementById(
    "ws-extract-btn",
  ) as HTMLButtonElement | null;
  if (button) {
    button.disabled = !authenticated;
    button.textContent = authenticated
      ? "Review loaded messages"
      : "Sign in to capture";
  }
}

function normalizeAuthToken(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

async function refreshLauncherFromValidatedAuthentication(): Promise<void> {
  const refreshGeneration = ++launcherAuthRefreshGeneration;
  authToken = null;
  resetLauncherAccountState(false);
  const authResponse = (await chrome.runtime.sendMessage({
    action: "GET_AUTH_STATUS",
  })) as ExtensionResponse<AuthStatusData>;
  if (refreshGeneration !== launcherAuthRefreshGeneration) return;
  if (authResponse.success) {
    launcherCaptureAuthGeneration = authResponse.data?.authGeneration || 0;
  }
  if (!authResponse.success || !authResponse.data?.isAuthenticated) return;

  const stored = await chrome.storage.local.get([STORAGE_KEYS.authToken]);
  if (refreshGeneration !== launcherAuthRefreshGeneration) return;
  authToken = normalizeAuthToken(stored[STORAGE_KEYS.authToken]);
  await refreshLauncherAuthenticationState(authToken);
}

async function refreshLauncherAuthenticationState(
  token: string | null,
): Promise<void> {
  const refreshGeneration = ++launcherAuthRefreshGeneration;
  resetLauncherAccountState(token !== null);
  if (token === null) return;
  const operationRenderGeneration = launcherOperationRenderGeneration;

  try {
    const [operationResponse, legacyResponse] = (await Promise.all([
      chrome.runtime.sendMessage({ action: "GET_CAPTURE_OPERATION" }),
      chrome.runtime.sendMessage({ action: "GET_LEGACY_QUEUE_SUMMARY" }),
    ])) as [
      ExtensionResponse<CaptureOperationSnapshot>,
      ExtensionResponse<{ count: number }>,
    ];
    if (refreshGeneration !== launcherAuthRefreshGeneration) return;
    if (
      operationRenderGeneration === launcherOperationRenderGeneration &&
      operationResponse.success &&
      operationResponse.data
    ) {
      renderCaptureOperation(operationResponse.data);
    }
    updateLegacyQueueState(
      legacyResponse.success ? legacyResponse.data?.count || 0 : 0,
    );
  } catch (error) {
    if (refreshGeneration !== launcherAuthRefreshGeneration) return;
    if (operationRenderGeneration !== launcherOperationRenderGeneration) return;
    resetLauncherAccountState(token !== null);
    throw error;
  }
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
}

function updateProgress(percent: number): void {
  const progressEl = document.getElementById("ws-progress");
  const progressBar = progressEl?.querySelector(
    ".ws-progress-bar",
  ) as HTMLElement;

  if (!progressEl || !progressBar) return;

  if (percent > 0 && percent < 100) {
    progressEl.classList.remove("ws-hidden");
    progressEl.setAttribute("aria-hidden", "false");
    progressBar.style.width = `${percent}%`;
  } else {
    progressEl.classList.add("ws-hidden");
    progressEl.setAttribute("aria-hidden", "true");
    progressBar.style.width = "0%";
  }
}

// =============================================================================
// Extraction Logic
// =============================================================================

function getCapturePreviewSummary(
  operationId: string,
): CapturePreviewSummary | null {
  const operation = activeCaptureOperation;
  const payload = operation?.payload;
  if (!operation || operation.operationId !== operationId || !payload) {
    return null;
  }
  const timestamps = payload.messages
    .map((message) => message.timestamp)
    .filter(Boolean)
    .sort();
  const trustedTimestamps = payload.messages
    .filter((message) => message.captureTimestampMethod === "metadata")
    .map((message) => message.timestamp)
    .filter(Boolean)
    .sort();
  const unreadableCount = payload.diagnostics.unreadableMessageCount;
  return {
    chatName: payload.chatName,
    loadedMessageCount: payload.messages.length,
    oldestTimestamp: timestamps[0],
    oldestTrustedTimestamp: trustedTimestamps[0],
    newestTimestamp: timestamps[timestamps.length - 1],
    participantLabelCount: payload.participants.filter(
      (participant) =>
        participant.isSelf ||
        Boolean(
          participant.rawDisplayName ||
            participant.rawUsername ||
            participant.normalizedPhone ||
            participant.platformUserId,
        ),
    ).length,
    mediaCount: payload.messages.filter((message) => message.isMedia).length,
    skippedCount: Math.max(
      0,
      payload.diagnostics.messageContainerCount -
        payload.messages.length -
        unreadableCount,
    ),
    unreadableCount,
    alignmentWarningCount: operation.alignmentWarningCount || 0,
  };
}

function formatPreviewTimestamp(value?: string): string {
  if (!value) return "Not detected";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not detected" : date.toLocaleString();
}

function renderPageCapturePreview(operation: CaptureOperationSnapshot): void {
  const review = document.getElementById("ws-capture-review");
  if (!review) return;
  if (!["ready-for-review", "retry-required"].includes(operation.state)) {
    review.hidden = true;
    return;
  }
  const preview = getCapturePreviewSummary(operation.operationId);
  if (!preview || preview.loadedMessageCount !== operation.extractedCount) {
    review.hidden = true;
    updateStatus(
      "The preview no longer matches the reviewed payload. Recapture before uploading.",
      "error",
    );
    return;
  }
  const values: Record<string, string> = {
    "ws-preview-chat-name": preview.chatName,
    "ws-preview-loaded": String(preview.loadedMessageCount),
    "ws-preview-participants": String(preview.participantLabelCount),
    "ws-preview-media": String(preview.mediaCount),
    "ws-preview-skipped": String(preview.skippedCount),
    "ws-preview-unreadable": String(preview.unreadableCount),
    "ws-preview-range": `Oldest: ${formatPreviewTimestamp(preview.oldestTimestamp)} · Newest: ${formatPreviewTimestamp(preview.newestTimestamp)}`,
  };
  for (const [id, value] of Object.entries(values)) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }
  const countLabel = document.getElementById("ws-preview-count-label");
  if (countLabel) {
    countLabel.textContent =
      operation.mode === "loaded" ? "Loaded messages" : "Captured messages";
  }
  const scopeCopy = document.getElementById("ws-scope-copy");
  if (scopeCopy) {
    scopeCopy.textContent =
      operation.mode === "guided"
        ? "Only the guided messages counted above will be uploaded. Collection stopped before review, and nothing is sent until you confirm."
        : operation.mode === "automatic"
          ? `Only the automatically collected messages counted above will be uploaded. ${automaticStopReasonLabel(operation.stopReason)} Nothing is sent until you confirm.`
          : "Only the loaded messages counted above will be uploaded. Older messages WhatsApp has not loaded are excluded. Nothing is sent until you confirm.";
  }
  const warning = document.getElementById("ws-preview-warning");
  if (warning) {
    warning.hidden = operation.alignmentWarningCount === 0;
    warning.textContent = operation.alignmentWarningCount
      ? `${operation.alignmentWarningCount} ambiguous overlap${operation.alignmentWarningCount === 1 ? " was" : "s were"} retained for review; no candidate occurrence was silently removed.`
      : "";
  }
  review.hidden = false;
}

function applyPageCaptureMode(selectedMode: string): void {
  document
    .querySelectorAll<HTMLElement>(".ws-capture-mode")
    .forEach((label) => {
      const input = label.querySelector<HTMLInputElement>(
        'input[name="ws-capture-mode"]',
      );
      const selected = input?.value === selectedMode;
      if (input) input.checked = selected;
      label.classList.toggle("ws-capture-mode-selected", selected);
      const status = label.querySelector("em");
      if (status) {
        status.textContent = selected ? "Selected" : "Available";
      }
    });
  const automaticOptions = document.getElementById("ws-automatic-options");
  if (automaticOptions) automaticOptions.hidden = selectedMode !== "automatic";
}

function handleCaptureModeChange(event: Event): void {
  const selectedMode = (event.target as HTMLInputElement).value;
  const generation = ++launcherModeChangeGeneration;
  applyPageCaptureMode(selectedMode);
  if (
    launcherOperation &&
    ((launcherOperation.mode === "loaded" && selectedMode !== "loaded") ||
      (launcherOperation.mode === "guided" && selectedMode !== "scroll") ||
      (launcherOperation.mode === "automatic" &&
        selectedMode !== "automatic")) &&
    [
      "inspecting",
      "collecting",
      "paused",
      "ready-for-review",
      "retry-required",
    ].includes(launcherOperation.state)
  ) {
    void reviewPageCapture(launcherOperation, false)
      .catch((error) => updateStatus(normalizeErrorMessage(error), "error"))
      .finally(() => {
        if (generation === launcherModeChangeGeneration) {
          applyPageCaptureMode(selectedMode);
        }
      });
  }
}

function selectedPageCaptureMode(): "loaded" | "guided" | "automatic" {
  const selected = document.querySelector<HTMLInputElement>(
    'input[name="ws-capture-mode"]:checked',
  )?.value;
  return selected === "scroll"
    ? "guided"
    : selected === "automatic"
      ? "automatic"
      : "loaded";
}

function selectedPageAutomaticBoundary(): AutomaticCaptureBoundary {
  const value = (
    document.getElementById("ws-automatic-boundary") as HTMLSelectElement | null
  )?.value;
  if (value === "days-7") return { kind: "days", days: 7 };
  if (value === "days-30") return { kind: "days", days: 30 };
  if (value?.startsWith("messages-")) {
    return { kind: "messages", messageLimit: Number(value.slice(9)) };
  }
  return { kind: "verified-top" };
}

async function handleExtractClick(): Promise<void> {
  try {
    const existingResponse = (await chrome.runtime.sendMessage({
      action: "GET_CAPTURE_OPERATION",
    })) as ExtensionResponse<CaptureOperationSnapshot>;
    const existingOperation =
      existingResponse.success &&
      existingResponse.data?.authGeneration === launcherCaptureAuthGeneration
        ? existingResponse.data
        : undefined;
    if (
      existingOperation &&
      ["ready-for-review", "retry-required"].includes(existingOperation.state)
    ) {
      renderCaptureOperation(existingOperation);
      if (existingOperation.state === "retry-required") {
        pageConfirmationOperationId = null;
      }
      return;
    }
    if (
      existingOperation &&
      ["inspecting", "collecting", "paused", "uploading"].includes(
        existingOperation.state,
      )
    ) {
      renderCaptureOperation(existingOperation);
      return;
    }
  } catch {
    // START_CAPTURE_OPERATION below remains the authoritative availability and
    // authentication check when no existing operation can be read.
  }

  // Check rate limiting
  if (!checkRateLimit()) {
    const waitTime = Math.ceil((state.rateLimitResetTime - Date.now()) / 1000);
    updateStatus(`Please wait ${waitTime}s before reviewing again`, "error");
    updateProgress(0);
    return;
  }

  try {
    const mode = selectedPageCaptureMode();
    if (
      mode === "automatic" &&
      !(
        document.getElementById(
          "ws-automatic-consent",
        ) as HTMLInputElement | null
      )?.checked
    ) {
      updateStatus(
        "Confirm that WhatsApp may scroll this chat before starting automatic capture.",
        "error",
      );
      return;
    }
    const response = (await chrome.runtime.sendMessage({
      action: "START_CAPTURE_OPERATION",
      initiator: "page",
      mode,
      ...(mode === "automatic"
        ? { automaticBoundary: selectedPageAutomaticBoundary() }
        : {}),
    })) as ExtensionResponse<CaptureOperationSnapshot>;
    if (!response.success || !response.data) {
      updateStatus(
        response.success ? "Capture could not start." : response.error,
        "error",
      );
      return;
    }
    if (!renderCaptureOperation(response.data)) return;
    if (["ready-for-review", "retry-required"].includes(response.data.state)) {
      if (response.data.state === "retry-required") {
        pageConfirmationOperationId = null;
      }
    }
  } catch (error) {
    updateStatus(normalizeErrorMessage(error), "error");
  }
}

async function stopPageCollection(
  operation: CaptureOperationSnapshot,
): Promise<void> {
  if (
    !["guided", "automatic"].includes(operation.mode) ||
    !["collecting", "paused"].includes(operation.state)
  )
    return;
  try {
    const automatic = operation.mode === "automatic";
    const response = (await chrome.runtime.sendMessage({
      action: automatic
        ? "CONTROL_AUTOMATIC_CAPTURE_OPERATION"
        : "STOP_GUIDED_CAPTURE_OPERATION",
      operationId: operation.operationId,
      ...(automatic
        ? { command: "stop", stopReason: "automatic-user-stopped" }
        : { stopReason: "guided-user-stopped" }),
    })) as ExtensionResponse<CaptureOperationSnapshot>;
    if (response.success && response.data) {
      renderCaptureOperation(response.data);
    } else {
      updateStatus(
        response.success ? "Collection could not stop." : response.error,
        "error",
      );
    }
  } catch (error) {
    updateStatus(normalizeErrorMessage(error), "error");
  }
}

async function reviewPageCapture(
  operation: CaptureOperationSnapshot,
  confirmed: boolean,
): Promise<void> {
  if (operation.authGeneration !== launcherCaptureAuthGeneration) return;
  if (pageConfirmationOperationId === operation.operationId) {
    if (pageConfirmationPromise) await pageConfirmationPromise;
    return;
  }
  if (confirmed) {
    const preview = getCapturePreviewSummary(operation.operationId);
    if (!preview || preview.loadedMessageCount !== operation.extractedCount) {
      updateStatus(
        "The preview no longer matches the reviewed payload. Recapture before uploading.",
        "error",
      );
      return;
    }
  }
  pageConfirmationOperationId = operation.operationId;
  const action = confirmed
    ? "CONFIRM_CAPTURE_OPERATION"
    : "CANCEL_CAPTURE_OPERATION";
  const confirmation = (async () => {
    try {
      const response = (await chrome.runtime.sendMessage({
        action,
        operationId: operation.operationId,
        reason: confirmed ? undefined : "Upload cancelled. Nothing was sent.",
      })) as ExtensionResponse<CaptureOperationSnapshot>;
      if (response.success && response.data) {
        if (response.data.state === "retry-required") {
          pageConfirmationOperationId = null;
        }
        if (!renderCaptureOperation(response.data)) {
          pageConfirmationOperationId = null;
        }
        return;
      }
      pageConfirmationOperationId = null;
      updateStatus(
        response.success ? "Capture could not continue." : response.error,
        "error",
      );
    } catch (error) {
      pageConfirmationOperationId = null;
      throw error;
    }
  })();
  pageConfirmationPromise = confirmation;
  try {
    await confirmation;
  } finally {
    if (pageConfirmationPromise === confirmation) {
      pageConfirmationPromise = null;
    }
  }
}

function renderCaptureOperation(operation: CaptureOperationSnapshot): boolean {
  if (operation.authGeneration !== launcherCaptureAuthGeneration) return false;
  launcherOperationRenderGeneration += 1;
  launcherOperation = operation;
  const modeValue = operation.mode === "guided" ? "scroll" : operation.mode;
  document
    .querySelectorAll<HTMLInputElement>('input[name="ws-capture-mode"]')
    .forEach((input) => {
      input.checked = input.value === modeValue;
      input
        .closest(".ws-capture-mode")
        ?.classList.toggle("ws-capture-mode-selected", input.checked);
      const status = input.closest(".ws-capture-mode")?.querySelector("em");
      if (status) {
        status.textContent = input.checked ? "Selected" : "Available";
      }
    });
  const automaticOptions = document.getElementById("ws-automatic-options");
  if (automaticOptions) automaticOptions.hidden = modeValue !== "automatic";
  updateLauncherBadge(operation);
  renderPageCapturePreview(operation);
  renderPageGuidedProgress(operation);
  if (activeCaptureOperation?.operationId === operation.operationId) {
    activeCaptureOperation.state = operation.state;
  }
  const button = document.getElementById(
    "ws-extract-btn",
  ) as HTMLButtonElement | null;
  if (button) {
    button.disabled = [
      "inspecting",
      "collecting",
      "paused",
      "uploading",
    ].includes(operation.state);
    button.textContent = getLauncherActionLabel(operation);
  }

  switch (operation.state) {
    case "inspecting":
      updateStatus("Reading loaded messages…", "loading");
      updateProgress(10);
      break;
    case "collecting":
      updateStatus(
        operation.mode === "guided"
          ? `Guided capture active: ${operation.extractedCount} unique message${operation.extractedCount === 1 ? "" : "s"}. Scroll upward, then stop and review.`
          : operation.mode === "automatic"
            ? `Automatic capture active: ${operation.extractedCount} unique message${operation.extractedCount === 1 ? "" : "s"}.`
            : "Reading loaded messages…",
        "loading",
      );
      updateProgress(operation.mode === "guided" ? 0 : 35);
      break;
    case "paused":
      updateStatus(
        `Automatic capture paused at ${operation.extractedCount} unique message${operation.extractedCount === 1 ? "" : "s"}.`,
        "info",
      );
      updateProgress(0);
      break;
    case "ready-for-review":
      updateProgress(0);
      updateStatus(
        operation.mode === "guided"
          ? `${operation.extractedCount} guided message${operation.extractedCount === 1 ? "" : "s"} ready for review. ${guidedStopReasonLabel(operation.stopReason)}`
          : operation.mode === "automatic"
            ? `${operation.extractedCount} automatic message${operation.extractedCount === 1 ? "" : "s"} ready for review. ${automaticStopReasonLabel(operation.stopReason)}`
            : `${operation.extractedCount} loaded message${operation.extractedCount === 1 ? "" : "s"} ready for review.`,
        "info",
      );
      break;
    case "uploading":
      updateStatus(
        `Sending ${operation.extractedCount} loaded messages…`,
        "loading",
      );
      updateProgress(75);
      break;
    case "received":
    case "duplicate":
      updateProgress(0);
      updateStatus(
        operation.reconciliationRequired
          ? `${operation.extractedCount} loaded messages stored separately. Review the possible prior intake in ConvoLens.`
          : operation.state === "duplicate"
            ? `${operation.extractedCount} loaded messages already exist in ConvoLens.`
            : `${operation.extractedCount} loaded messages received by ConvoLens.`,
        "success",
      );
      if (lastCountedTerminalOperationId !== operation.operationId) {
        lastCountedTerminalOperationId = operation.operationId;
        state.lastExtraction = Date.now();
        state.extractionCount++;
      }
      break;
    case "retry-required":
      updateProgress(0);
      updateStatus(
        operation.reason || "Upload not sent. Review and retry from this tab.",
        "error",
      );
      break;
    case "failed":
    case "cancelled":
      updateProgress(0);
      updateStatus(operation.reason || "Capture cancelled.", "error");
      break;
  }
  return true;
}

function guidedStopReasonLabel(
  reason: CaptureOperationSnapshot["stopReason"],
): string {
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

function automaticStopReasonLabel(
  reason: CaptureOperationSnapshot["stopReason"],
): string {
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

function renderPageGuidedProgress(operation: CaptureOperationSnapshot): void {
  const panel = document.getElementById("ws-guided-progress");
  if (!panel) return;
  const active =
    ["guided", "automatic"].includes(operation.mode) &&
    ["collecting", "paused"].includes(operation.state);
  panel.hidden = !active;
  if (!active) return;
  const automatic = operation.mode === "automatic";
  const title = document.getElementById("ws-collection-title");
  const instruction = document.getElementById("ws-collection-instruction");
  const pauseButton = document.getElementById(
    "ws-pause-automatic",
  ) as HTMLButtonElement | null;
  if (title) {
    title.textContent = automatic
      ? operation.state === "paused"
        ? "Automatic capture is paused"
        : "Automatic capture is active"
      : "Guided capture is active";
  }
  if (instruction) {
    instruction.textContent = automatic
      ? "Keep this chat open. ConvoLens is loading older history within the selected boundary."
      : "Scroll upward in this chat. ConvoLens will retain each message window before WhatsApp removes it.";
  }
  if (pauseButton) {
    pauseButton.hidden = !automatic;
    pauseButton.textContent = operation.state === "paused" ? "Resume" : "Pause";
  }
  const count = document.getElementById("ws-guided-count");
  const oldest = document.getElementById("ws-guided-oldest");
  const warning = document.getElementById("ws-guided-warning");
  if (count) count.textContent = String(operation.extractedCount);
  if (oldest)
    oldest.textContent = formatPreviewTimestamp(operation.oldestTimestamp);
  if (warning) {
    warning.hidden = operation.alignmentWarningCount === 0;
    warning.textContent = operation.alignmentWarningCount
      ? "An overlap could not be aligned unambiguously. Candidate occurrences were retained; use smaller upward scroll steps."
      : "";
  }
}

function getLauncherActionLabel(operation: CaptureOperationSnapshot): string {
  switch (operation.state) {
    case "inspecting":
      return "Reading loaded messages…";
    case "collecting":
      return operation.mode === "guided"
        ? `Guided: ${operation.extractedCount} captured`
        : operation.mode === "automatic"
          ? `Automatic: ${operation.extractedCount} captured`
          : "Reading loaded messages…";
    case "paused":
      return `Automatic paused: ${operation.extractedCount}`;
    case "ready-for-review":
      return `Review ${operation.extractedCount} loaded message${operation.extractedCount === 1 ? "" : "s"}`;
    case "uploading":
      return "Sending reviewed messages…";
    case "retry-required":
      return "Review and retry";
    default:
      return "Review loaded messages";
  }
}

function updateLauncherBadge(operation: CaptureOperationSnapshot | null): void {
  const fab = document.getElementById("convolens-fab");
  const badge = document.getElementById("ws-launcher-badge");
  if (!fab || !badge) return;
  const terminalAttention =
    operation !== null &&
    ["received", "duplicate"].includes(operation.state) &&
    (operation.reconciliationRequired || legacyQueueCount > 0);
  const state = terminalAttention
    ? "attention"
    : operation?.state || (legacyQueueCount > 0 ? "attention" : "ready");
  fab.dataset.state = state;
  let value = "";
  if (operation?.state === "ready-for-review") {
    value = String(operation.extractedCount);
  } else if (
    operation &&
    ["inspecting", "collecting", "uploading"].includes(operation.state)
  ) {
    value = "…";
  } else if (
    operation &&
    ["retry-required", "failed", "cancelled"].includes(operation.state)
  ) {
    value = "!";
  } else if (
    operation &&
    ["received", "duplicate"].includes(operation.state) &&
    (operation.reconciliationRequired || legacyQueueCount > 0)
  ) {
    value = "!";
  } else if (operation && ["received", "duplicate"].includes(operation.state)) {
    value = "✓";
  } else if (legacyQueueCount > 0) {
    value = "!";
  }
  badge.textContent = value;
  badge.toggleAttribute("data-visible", value.length > 0);
  updateLauncherToggleLabel();
}

function updateLauncherToggleLabel(): void {
  const toggle = document.getElementById(
    "ws-launcher-toggle",
  ) as HTMLButtonElement | null;
  if (!toggle) return;
  const action =
    toggle.getAttribute("aria-expanded") === "true" ? "Close" : "Open";
  toggle.setAttribute(
    "aria-label",
    `${action} ConvoLens capture panel. ${getLauncherAccessibleStatus()} Drag to move.`,
  );
}

function getLauncherAccessibleStatus(): string {
  if (launcherOperation?.state === "ready-for-review") {
    return `${launcherOperation.extractedCount} loaded message${launcherOperation.extractedCount === 1 ? "" : "s"} ready for review.`;
  }
  if (
    launcherOperation &&
    ["inspecting", "collecting"].includes(launcherOperation.state)
  ) {
    return "Reading loaded messages.";
  }
  if (launcherOperation?.state === "uploading") {
    return "Sending reviewed messages.";
  }
  if (
    launcherOperation &&
    ["retry-required", "failed", "cancelled"].includes(launcherOperation.state)
  ) {
    return "Capture needs attention.";
  }
  if (
    launcherOperation &&
    ["received", "duplicate"].includes(launcherOperation.state) &&
    launcherOperation.reconciliationRequired
  ) {
    return "Capture received. Reconciliation review required.";
  }
  if (
    launcherOperation &&
    ["received", "duplicate"].includes(launcherOperation.state) &&
    legacyQueueCount > 0
  ) {
    return `Capture received. ${legacyQueueCount} legacy local capture${legacyQueueCount === 1 ? "" : "s"} need review.`;
  }
  if (
    launcherOperation &&
    ["received", "duplicate"].includes(launcherOperation.state)
  ) {
    return "Capture received by ConvoLens.";
  }
  if (legacyQueueCount > 0) {
    return `${legacyQueueCount} legacy local capture${legacyQueueCount === 1 ? "" : "s"} need review.`;
  }
  return "Ready.";
}

function getCurrentChatIdentity(): string {
  const messageList = findConversationRoot(
    document,
    SELECTORS.primary.messageList,
    SELECTORS.fallback.messageList,
  );
  const messageContainers = messageList
    ? findMessageContainers(
        messageList,
        SELECTORS.primary.messageContainer,
        SELECTORS.fallback.messageContainer,
      )
    : [];
  const stableId = extractStableWhatsAppConversationId([
    messageList?.getAttribute("data-chat-id"),
    messageList?.getAttribute("data-jid"),
    messageList?.closest("[data-chat-id]")?.getAttribute("data-chat-id"),
    messageList?.closest("[data-jid]")?.getAttribute("data-jid"),
    ...messageContainers
      .slice(0, 10)
      .map((container) =>
        findMessageRecord(container as HTMLElement).getAttribute("data-id"),
      ),
  ]);
  if (stableId) return stableId;

  const header = querySelector(
    SELECTORS.primary.contactName,
    SELECTORS.fallback.contactName,
  )
    ?.textContent?.trim()
    .toLocaleLowerCase();
  return header ? `header:${header}` : "unselected";
}

function getOpaqueChatKey(chatIdentity: string): string {
  const existing = chatIdentityTokens.get(chatIdentity);
  if (existing) return existing;
  const token = crypto.randomUUID();
  chatIdentityTokens.set(chatIdentity, token);
  return token;
}

function participantIdentityKey(participant: ExtractedParticipant): string {
  return participant.isSelf
    ? "self"
    : participant.platformUserId ||
        participant.normalizedPhone ||
        participant.rawUsername ||
        participant.rawDisplayName ||
        participant.ref;
}

function nextParticipantRef(participants: ExtractedParticipant[]): string {
  const next =
    participants.reduce((highest, participant) => {
      const value = Number(participant.ref.match(/^participant_(\d+)$/)?.[1]);
      return Number.isInteger(value) ? Math.max(highest, value) : highest;
    }, 0) + 1;
  return `participant_${next}`;
}

function cloneGuidedMessage(
  message: ExtractedMessage,
  senderRef: string | undefined,
): ExtractedMessage {
  const clone: ExtractedMessage = { ...message, senderRef };
  Object.defineProperties(clone, {
    captureSourceId: {
      value: message.captureSourceId,
      enumerable: false,
    },
    captureAlignmentToken: {
      value: message.captureAlignmentToken,
      enumerable: false,
    },
    captureMetadataPath: {
      value: message.captureMetadataPath,
      enumerable: false,
    },
    captureSenderMethod: {
      value: message.captureSenderMethod,
      enumerable: false,
    },
    captureTimestampMethod: {
      value: message.captureTimestampMethod,
      enumerable: false,
    },
  });
  return clone;
}

function guidedItems(
  messages: ExtractedMessage[],
): GuidedWindowItem<ExtractedMessage>[] {
  return messages.map((message) => ({
    stableId: message.captureSourceId,
    alignmentToken:
      message.captureAlignmentToken ||
      JSON.stringify({
        sender: message.sender,
        text: message.text,
        timestamp: message.timestamp,
        direction: message.isOutgoing,
        mediaType: message.mediaType || "none",
      }),
    value: message,
  }));
}

function guidedMergeEdge(
  existing: GuidedWindowItem<ExtractedMessage>[],
  incoming: GuidedWindowItem<ExtractedMessage>[],
): GuidedMergeEdge | null {
  if (existing.length === 0 || incoming.length === 0) return "prepend";
  const existingIds = new Set(
    existing
      .map((item) => item.stableId)
      .filter((id): id is string => Boolean(id)),
  );
  if (incoming[0].stableId && existingIds.has(incoming[0].stableId)) {
    return "append";
  }
  const lastIncomingId = incoming[incoming.length - 1].stableId;
  if (lastIncomingId && existingIds.has(lastIncomingId)) {
    return "prepend";
  }
  const prepend = mergeGuidedWindow(existing, incoming, "prepend");
  const append = mergeGuidedWindow(existing, incoming, "append");
  if (append.overlapCount !== prepend.overlapCount) {
    return append.overlapCount > prepend.overlapCount ? "append" : "prepend";
  }
  if (append.overlapCount > 0) return "prepend";
  return resolveDisjointGuidedEdge(
    existing.flatMap((item) =>
      item.value.captureTimestampMethod === "metadata"
        ? [item.value.timestamp]
        : [],
    ),
    incoming.flatMap((item) =>
      item.value.captureTimestampMethod === "metadata"
        ? [item.value.timestamp]
        : [],
    ),
  );
}

function summarizeCapturePayload(
  payload: ExtractedChat,
  chatIdentity: string,
  skippedCount: number,
  unreadableCount: number,
  alignmentWarningCount: number,
): CaptureCollectionSummary {
  const timestamps = payload.messages
    .map((message) => message.timestamp)
    .filter(Boolean)
    .sort();
  const trustedTimestamps = payload.messages
    .filter((message) => message.captureTimestampMethod === "metadata")
    .map((message) => message.timestamp)
    .filter(Boolean)
    .sort();
  return {
    chatKey: getOpaqueChatKey(chatIdentity),
    renderedCount: payload.messages.length + skippedCount + unreadableCount,
    extractedCount: payload.messages.length,
    skippedCount,
    unreadableCount,
    participantLabelCount: payload.participants.filter(
      (participant) =>
        participant.isSelf ||
        Boolean(
          participant.rawDisplayName ||
            participant.rawUsername ||
            participant.normalizedPhone ||
            participant.platformUserId,
        ),
    ).length,
    alignmentWarningCount,
    mediaCount: payload.messages.filter((message) => message.isMedia).length,
    oldestTimestamp: timestamps[0],
    oldestTrustedTimestamp: trustedTimestamps[0],
    newestTimestamp: timestamps[timestamps.length - 1],
  };
}

function summarizeGuidedDiagnosticMethods(
  messages: ExtractedMessage[],
): Pick<
  ExtractionDiagnostics,
  "metadataPathCounts" | "senderMethodCounts" | "timestampMethodCounts"
> {
  const metadataPathCounts: ExtractionDiagnostics["metadataPathCounts"] = {
    container: 0,
    ancestor: 0,
    descendant: 0,
    none: 0,
  };
  const senderMethodCounts: ExtractionDiagnostics["senderMethodCounts"] = {
    metadata: 0,
    "sender-element": 0,
    "conversation-header": 0,
    outgoing: 0,
    fallback: 0,
  };
  const timestampMethodCounts: ExtractionDiagnostics["timestampMethodCounts"] =
    {
      metadata: 0,
      "visible-time": 0,
      fallback: 0,
    };
  for (const message of messages) {
    if (message.captureMetadataPath) {
      metadataPathCounts[message.captureMetadataPath] += 1;
    }
    if (message.captureSenderMethod) {
      senderMethodCounts[message.captureSenderMethod] += 1;
    }
    if (message.captureTimestampMethod) {
      timestampMethodCounts[message.captureTimestampMethod] += 1;
    }
  }
  return { metadataPathCounts, senderMethodCounts, timestampMethodCounts };
}

function mergeGuidedPayload(
  session: GuidedCaptureSession,
  incoming: ExtractedChat,
): CaptureCollectionSummary {
  const candidateParticipants = [...session.payload.participants];
  const canonicalParticipants = new Map(
    candidateParticipants.map((participant) => [
      participantIdentityKey(participant),
      participant,
    ]),
  );
  const remappedRefs = new Map<string, string>();
  for (const participant of incoming.participants) {
    const key = participantIdentityKey(participant);
    let canonical = canonicalParticipants.get(key);
    if (!canonical) {
      canonical = {
        ...participant,
        ref: nextParticipantRef(candidateParticipants),
      };
      candidateParticipants.push(canonical);
      canonicalParticipants.set(key, canonical);
    }
    remappedRefs.set(participant.ref, canonical.ref);
  }
  const remappedMessages = incoming.messages.map((message) =>
    cloneGuidedMessage(
      message,
      message.senderRef ? remappedRefs.get(message.senderRef) : undefined,
    ),
  );
  const incomingItems = guidedItems(remappedMessages);
  const mergeEdge = guidedMergeEdge(session.items, incomingItems);
  let merge = mergeGuidedWindow(
    session.items,
    incomingItems,
    mergeEdge || "prepend",
    mergeEdge ? session.captureLimit : undefined,
  );
  if (mergeEdge === null) {
    merge =
      merge.items.length > session.captureLimit
        ? {
            items: session.items,
            addedCount: 0,
            overlapCount: 0,
            ambiguous: true,
            limitReached: true,
          }
        : { ...merge, ambiguous: true };
  }
  session.items = merge.items;
  if (merge.ambiguous) {
    const retainedAmbiguousItems = incomingItems.filter((item) =>
      merge.items.includes(item),
    );
    if (retainedAmbiguousItems.length > 0) {
      session.alignmentWarnings.push(retainedAmbiguousItems);
    }
  }
  reconcileGuidedAlignmentWarnings(session);
  if (merge.limitReached) session.limitReached = true;
  const incomingSkipped = Math.max(
    0,
    incoming.diagnostics.messageContainerCount -
      incoming.messages.length -
      incoming.diagnostics.unreadableMessageCount,
  );
  const addedRatio =
    incoming.messages.length > 0
      ? Math.min(1, merge.addedCount / incoming.messages.length)
      : 0;
  session.skippedCount += Math.ceil(incomingSkipped * addedRatio);
  session.unreadableCount += Math.ceil(
    incoming.diagnostics.unreadableMessageCount * addedRatio,
  );
  session.payload.messages = session.items.map((item) => item.value);
  const retainedParticipantRefs = new Set(
    session.payload.messages
      .map((message) => message.senderRef)
      .filter((ref): ref is string => Boolean(ref)),
  );
  session.payload.participants = candidateParticipants.filter((participant) =>
    retainedParticipantRefs.has(participant.ref),
  );
  session.payload.messageCount = session.payload.messages.length;
  session.payload.extractedAt = new Date().toISOString();
  const diagnosticMethods = summarizeGuidedDiagnosticMethods(
    session.payload.messages,
  );
  session.payload.diagnostics = {
    ...session.payload.diagnostics,
    messageContainerCount:
      session.payload.messages.length +
      session.skippedCount +
      session.unreadableCount,
    extractedMessageCount: session.payload.messages.length,
    unreadableMessageCount: session.unreadableCount,
    ...diagnosticMethods,
  };
  if (activeCaptureOperation?.operationId === session.operationId) {
    activeCaptureOperation.payload = session.payload;
    activeCaptureOperation.alignmentWarningCount =
      session.alignmentWarningCount;
  }
  return summarizeCapturePayload(
    session.payload,
    session.chatIdentity,
    session.skippedCount,
    session.unreadableCount,
    session.alignmentWarningCount,
  );
}

function reconcileGuidedAlignmentWarnings(session: GuidedCaptureSession): void {
  const retainedItems = new Set(session.items);
  session.alignmentWarnings = session.alignmentWarnings.filter((warningItems) =>
    warningItems.some((item) => retainedItems.has(item)),
  );
  session.alignmentWarningCount = session.alignmentWarnings.length;
}

function teardownGuidedCaptureSession(operationId: string): void {
  const session = guidedCaptureSession;
  if (!session || session.operationId !== operationId) return;
  restoreAutomaticScrollAnchor(session);
  pauseGuidedCaptureSession(session);
  guidedCaptureSession = null;
}

function pauseGuidedCaptureSession(session: GuidedCaptureSession): void {
  session.observer.disconnect();
  session.scrollTarget.removeEventListener("scroll", queueGuidedWindowRead);
  if (session.timeoutId !== undefined) window.clearTimeout(session.timeoutId);
  session.timeoutId = undefined;
}

function resolveAutomaticScrollTarget(messageList: Element): HTMLElement {
  let candidate: HTMLElement | null = messageList as HTMLElement;
  for (let depth = 0; candidate && depth < 8; depth += 1) {
    if (candidate.scrollHeight > candidate.clientHeight + 1) return candidate;
    candidate = candidate.parentElement;
  }
  return messageList as HTMLElement;
}

function restoreAutomaticScrollAnchor(session: GuidedCaptureSession): void {
  if (
    session.mode !== "automatic" ||
    session.originalBottomOffset === undefined ||
    getCurrentChatIdentity() !== session.chatIdentity
  ) {
    return;
  }
  const targetTop = Math.max(
    0,
    session.scrollTarget.scrollHeight - session.originalBottomOffset,
  );
  session.scrollTarget.scrollTop = Number.isFinite(targetTop)
    ? targetTop
    : session.originalScrollTop || 0;
}

function hasVerifiedTopOfHistory(scrollTarget: HTMLElement): boolean {
  if (scrollTarget.scrollTop > 1) return false;
  return Boolean(
    scrollTarget.querySelector(
      '[data-testid="conversation-start"], [data-testid="chat-history-start"], [aria-rowindex="1"]',
    ),
  );
}

async function waitForAutomaticStabilization(
  session: GuidedCaptureSession,
  baselineObservedWindowCount: number,
): Promise<void> {
  const started = Date.now();
  let previousTop = session.scrollTarget.scrollTop;
  let previousHeight = session.scrollTarget.scrollHeight;
  let stableSamples = 0;
  while (
    guidedCaptureSession === session &&
    !session.finalizing &&
    Date.now() - started < AUTOMATIC_STABILIZATION_TIMEOUT_MS
  ) {
    await new Promise((resolve) =>
      window.setTimeout(resolve, AUTOMATIC_STABILIZATION_INTERVAL_MS),
    );
    const nextTop = session.scrollTarget.scrollTop;
    const nextHeight = session.scrollTarget.scrollHeight;
    const observedChange =
      session.observedWindowCount > baselineObservedWindowCount;
    if (
      observedChange &&
      nextTop === previousTop &&
      nextHeight === previousHeight
    ) {
      stableSamples += 1;
      if (stableSamples >= 2) return;
    } else {
      stableSamples = 0;
      previousTop = nextTop;
      previousHeight = nextHeight;
    }
  }
}

async function togglePageAutomaticCapture(
  operation: CaptureOperationSnapshot,
): Promise<void> {
  if (
    operation.mode !== "automatic" ||
    !["collecting", "paused"].includes(operation.state)
  )
    return;
  try {
    const response = (await chrome.runtime.sendMessage({
      action: "CONTROL_AUTOMATIC_CAPTURE_OPERATION",
      operationId: operation.operationId,
      command: operation.state === "paused" ? "resume" : "pause",
    })) as ExtensionResponse<CaptureOperationSnapshot>;
    if (response.success && response.data)
      renderCaptureOperation(response.data);
    else
      updateStatus(
        response.success
          ? "Automatic capture could not be updated."
          : response.error,
        "error",
      );
  } catch (error) {
    updateStatus(normalizeErrorMessage(error), "error");
  }
}

function automaticLimitStopReason(
  session: GuidedCaptureSession,
): Exclude<CaptureStopReason, "loaded-window"> {
  return session.automaticBoundary?.kind === "messages" &&
    session.captureLimit < AUTOMATIC_CAPTURE_SAFETY_CAP
    ? "automatic-message-limit"
    : "automatic-safety-cap";
}

function automaticBoundaryReason(
  session: GuidedCaptureSession,
  verifiedTop: boolean,
): Exclude<CaptureStopReason, "loaded-window"> | null {
  if (!session.automaticBoundary || !session.automaticStartedAt) return null;
  const oldestTrustedTimestamp = session.items
    .filter((item) => item.value.captureTimestampMethod === "metadata")
    .map((item) => item.value.timestamp)
    .filter(Boolean)
    .sort()[0];
  const reason = automaticBoundaryStopReason({
    boundary: session.automaticBoundary,
    extractedCount: session.items.length,
    oldestTrustedTimestamp,
    verifiedTop,
    startedAt: session.automaticStartedAt,
  });
  return reason === "loaded-window" ? null : reason;
}

function retainAutomaticItems(
  session: GuidedCaptureSession,
  items: GuidedWindowItem<ExtractedMessage>[],
): void {
  session.items = items;
  reconcileGuidedAlignmentWarnings(session);
  session.payload.messages = items.map((item) => item.value);
  session.payload.messageCount = session.payload.messages.length;
  session.skippedCount = 0;
  session.unreadableCount = 0;
  session.payload.diagnostics = {
    ...session.payload.diagnostics,
    messageContainerCount: session.payload.messages.length,
    extractedMessageCount: session.payload.messages.length,
    unreadableMessageCount: 0,
    ...summarizeGuidedDiagnosticMethods(session.payload.messages),
  };
  const retainedParticipantRefs = new Set(
    session.payload.messages.flatMap((message) =>
      [message.senderRef].filter((value): value is string => Boolean(value)),
    ),
  );
  session.payload.participants = session.payload.participants.filter(
    (participant) => retainedParticipantRefs.has(participant.ref),
  );
}

function trimAutomaticDateBoundary(session: GuidedCaptureSession): void {
  if (!session.automaticBoundary || !session.automaticStartedAt) return;
  const startIndex = automaticDateBoundaryStartIndex(
    session.items.map((item) =>
      item.value.captureTimestampMethod === "metadata"
        ? item.value.timestamp
        : undefined,
    ),
    session.automaticBoundary,
    session.automaticStartedAt,
  );
  if (startIndex !== null) {
    retainAutomaticItems(session, session.items.slice(startIndex));
  }
}

async function runAutomaticCapture(
  session: GuidedCaptureSession,
): Promise<void> {
  while (guidedCaptureSession === session && !session.finalizing) {
    if (session.automaticPaused) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
      continue;
    }
    const existingReason = automaticBoundaryReason(
      session,
      hasVerifiedTopOfHistory(session.scrollTarget),
    );
    if (existingReason) {
      if (existingReason === "automatic-date-boundary") {
        trimAutomaticDateBoundary(session);
      }
      session.pendingStopReason = existingReason;
      if (!session.drainPromise) startGuidedWindowDrain(session);
      return;
    }

    const beforeTop = session.scrollTarget.scrollTop;
    const beforeHeight = session.scrollTarget.scrollHeight;
    const beforeCount = session.items.length;
    const beforeObservedWindowCount = session.observedWindowCount;
    const step = Math.max(
      320,
      Math.floor(session.scrollTarget.clientHeight * 0.8),
    );
    session.scrollTarget.scrollTop = Math.max(0, beforeTop - step);
    queueGuidedWindowRead();
    await waitForAutomaticStabilization(session, beforeObservedWindowCount);
    if (session.drainPromise) await session.drainPromise;
    if (guidedCaptureSession !== session || session.finalizing) return;
    if (session.automaticPaused) continue;

    const verifiedTop = hasVerifiedTopOfHistory(session.scrollTarget);
    const boundaryReason = automaticBoundaryReason(session, verifiedTop);
    if (boundaryReason) {
      if (boundaryReason === "automatic-date-boundary") {
        trimAutomaticDateBoundary(session);
      }
      session.pendingStopReason = boundaryReason;
      if (!session.drainPromise) startGuidedWindowDrain(session);
      return;
    }
    const progressed =
      session.items.length > beforeCount ||
      session.scrollTarget.scrollTop !== beforeTop ||
      session.scrollTarget.scrollHeight !== beforeHeight;
    session.noProgressCount = progressed ? 0 : session.noProgressCount + 1;
    if (session.noProgressCount >= AUTOMATIC_NO_PROGRESS_LIMIT) {
      session.pendingStopReason = verifiedTop
        ? "automatic-verified-top"
        : "automatic-no-progress";
      if (!session.drainPromise) startGuidedWindowDrain(session);
      return;
    }
  }
}

function queueGuidedWindowRead(): void {
  const session = guidedCaptureSession;
  if (!session || session.finalizing) return;
  // Start extraction in the observer callback so the current virtualized DOM
  // window is snapshotted before WhatsApp can replace it. The promises are
  // merged in FIFO order to keep progress updates and retained order stable.
  session.pendingWindows.push(extractCurrentChat(true).catch(() => null));
  startGuidedWindowDrain(session);
}

function queueObservedGuidedWindowRead(): void {
  const session = guidedCaptureSession;
  if (!session || session.finalizing) return;
  session.observedWindowCount += 1;
  queueGuidedWindowRead();
}

function startGuidedWindowDrain(session: GuidedCaptureSession): void {
  if (session.drainPromise) return;
  const drain = drainGuidedWindowReads(session);
  session.drainPromise = drain;
  const finishDrain = () => {
    if (session.drainPromise === drain) session.drainPromise = undefined;
    if (session.pendingWindows.length > 0 && guidedCaptureSession === session) {
      startGuidedWindowDrain(session);
    } else if (
      session.pendingStopReason &&
      !session.finalizing &&
      guidedCaptureSession === session
    ) {
      const stopReason = session.pendingStopReason;
      session.pendingStopReason = undefined;
      void chrome.runtime.sendMessage(
        session.mode === "automatic"
          ? {
              action: "CONTROL_AUTOMATIC_CAPTURE_OPERATION",
              operationId: session.operationId,
              command: "stop",
              stopReason,
            }
          : {
              action: "STOP_GUIDED_CAPTURE_OPERATION",
              operationId: session.operationId,
              stopReason,
            },
      );
    }
  };
  void drain.then(finishDrain, finishDrain);
}

async function drainGuidedWindowReads(
  session: GuidedCaptureSession,
): Promise<void> {
  if (guidedCaptureSession !== session) return;
  if (session.reading) return;
  session.reading = true;
  if (getCurrentChatIdentity() !== session.chatIdentity) {
    teardownGuidedCaptureSession(session.operationId);
    activeCaptureOperation = null;
    sendRuntimeLifecycleMessage({
      action: "CANCEL_CAPTURE_OPERATION",
      operationId: session.operationId,
      reason: "The selected chat changed. Nothing was sent.",
    });
    return;
  }
  try {
    while (session.pendingWindows.length > 0) {
      const pendingWindow = session.pendingWindows.shift();
      if (!pendingWindow) break;
      try {
        const incoming = await pendingWindow;
        if (guidedCaptureSession !== session) return;
        if (!incoming)
          throw new Error("The observed window could not be read.");
        if (getCurrentChatIdentity() !== session.chatIdentity) {
          teardownGuidedCaptureSession(session.operationId);
          activeCaptureOperation = null;
          sendRuntimeLifecycleMessage({
            action: "CANCEL_CAPTURE_OPERATION",
            operationId: session.operationId,
            reason: "The selected chat changed. Nothing was sent.",
          });
          return;
        }
        session.consecutiveFailures = 0;
        const summary = mergeGuidedPayload(session, incoming);
        await chrome.runtime.sendMessage({
          action:
            session.mode === "automatic"
              ? "UPDATE_AUTOMATIC_CAPTURE_OPERATION"
              : "UPDATE_GUIDED_CAPTURE_OPERATION",
          operationId: session.operationId,
          summary,
        });
        if (session.limitReached) {
          session.pendingStopReason =
            session.mode === "automatic"
              ? automaticLimitStopReason(session)
              : "guided-safety-limit";
          session.pendingWindows.length = 0;
          return;
        }
      } catch {
        session.consecutiveFailures += 1;
        if (session.consecutiveFailures >= 3) {
          session.pendingStopReason =
            session.mode === "automatic"
              ? "automatic-dom-failure"
              : "guided-dom-failure";
          session.pendingWindows.length = 0;
          return;
        }
      }
    }
  } finally {
    session.reading = false;
  }
}

async function startGuidedCaptureOperation(
  operationId: string,
  chatIdentity: string,
  initialPayload: ExtractedChat,
  mode: "guided" | "automatic",
): Promise<CaptureCollectionSummary> {
  const messageList = findConversationRoot(
    document,
    SELECTORS.primary.messageList,
    SELECTORS.fallback.messageList,
  );
  if (!messageList) throw new Error("Could not observe the selected chat.");
  const unreadableCount = initialPayload.diagnostics.unreadableMessageCount;
  const skippedCount = Math.max(
    0,
    initialPayload.diagnostics.messageContainerCount -
      initialPayload.messages.length -
      unreadableCount,
  );
  const observer = new MutationObserver(queueObservedGuidedWindowRead);
  const scrollTarget =
    mode === "automatic"
      ? resolveAutomaticScrollTarget(messageList)
      : (messageList as HTMLElement);
  const session: GuidedCaptureSession = {
    operationId,
    chatIdentity,
    payload: initialPayload,
    mode,
    captureLimit:
      mode === "automatic"
        ? AUTOMATIC_CAPTURE_SAFETY_CAP
        : GUIDED_CAPTURE_LIMIT,
    items: guidedItems(initialPayload.messages),
    observer,
    scrollTarget,
    consecutiveFailures: 0,
    alignmentWarningCount: 0,
    alignmentWarnings: [],
    skippedCount,
    unreadableCount,
    reading: false,
    pendingWindows: [],
    finalizing: false,
    limitReached: false,
    automaticPaused: false,
    noProgressCount: 0,
    observedWindowCount: 0,
  };
  guidedCaptureSession = session;
  return summarizeCapturePayload(
    initialPayload,
    chatIdentity,
    skippedCount,
    unreadableCount,
    0,
  );
}

function activateGuidedCaptureOperation(operationId: string): void {
  const session = guidedCaptureSession;
  if (!session || session.operationId !== operationId) {
    throw new Error("The guided capture buffer is no longer available.");
  }
  if (session.timeoutId !== undefined) return;
  session.observer.observe(session.scrollTarget, {
    childList: true,
    subtree: true,
  });
  session.scrollTarget.addEventListener("scroll", queueGuidedWindowRead, {
    passive: true,
  });
  session.timeoutId = window.setTimeout(() => {
    if (guidedCaptureSession?.operationId !== operationId) return;
    void chrome.runtime.sendMessage({
      action: "STOP_GUIDED_CAPTURE_OPERATION",
      operationId,
      stopReason: "guided-timeout",
    });
  }, GUIDED_CAPTURE_TIMEOUT_MS);
}

function activateAutomaticCaptureOperation(
  operationId: string,
  requestedBoundary: AutomaticCaptureBoundary,
): void {
  const session = guidedCaptureSession;
  if (
    !session ||
    session.operationId !== operationId ||
    session.mode !== "automatic"
  ) {
    throw new Error("The automatic capture buffer is no longer available.");
  }
  if (session.automaticRunner) return;
  const boundary = normalizeAutomaticBoundary(requestedBoundary);
  session.automaticBoundary = boundary;
  session.automaticStartedAt = new Date();
  session.captureLimit =
    boundary.kind === "messages"
      ? Math.min(AUTOMATIC_CAPTURE_SAFETY_CAP, boundary.messageLimit)
      : AUTOMATIC_CAPTURE_SAFETY_CAP;
  if (session.items.length > session.captureLimit) {
    retainAutomaticItems(session, session.items.slice(-session.captureLimit));
  }
  session.originalScrollTop = session.scrollTarget.scrollTop;
  session.originalBottomOffset =
    session.scrollTarget.scrollHeight - session.scrollTarget.scrollTop;
  session.observer.observe(session.scrollTarget, {
    childList: true,
    subtree: true,
  });
  session.automaticRunner = runAutomaticCapture(session).catch(() => {
    if (guidedCaptureSession !== session || session.finalizing) return;
    session.pendingStopReason = "automatic-dom-failure";
    if (!session.drainPromise) startGuidedWindowDrain(session);
  });
}

async function setAutomaticCapturePaused(
  operationId: string,
  paused: boolean,
): Promise<void> {
  const session = guidedCaptureSession;
  if (
    !session ||
    session.operationId !== operationId ||
    session.mode !== "automatic" ||
    session.finalizing
  ) {
    throw new Error("The automatic capture buffer is no longer available.");
  }
  session.automaticPaused = paused;
  if (paused) {
    session.observer.disconnect();
    if (session.drainPromise) await session.drainPromise;
    return;
  }
  if (guidedCaptureSession !== session || session.finalizing) {
    throw new Error("The automatic capture buffer is no longer available.");
  }
  session.observer.observe(session.scrollTarget, {
    childList: true,
    subtree: true,
  });
}

async function finalizeGuidedCaptureOperation(
  operationId: string,
  prepareSummary?: (session: GuidedCaptureSession) => void,
): Promise<CaptureCollectionSummary> {
  const session = guidedCaptureSession;
  if (!session || session.operationId !== operationId) {
    throw new Error("The guided capture buffer is no longer available.");
  }
  // Prevent new observations first, then retain every snapshot that was
  // already queued before computing the review summary.
  session.finalizing = true;
  pauseGuidedCaptureSession(session);
  if (session.drainPromise) await session.drainPromise;
  if (guidedCaptureSession !== session) {
    throw new Error("The guided capture buffer is no longer available.");
  }
  prepareSummary?.(session);
  const summary = summarizeCapturePayload(
    session.payload,
    session.chatIdentity,
    session.skippedCount,
    session.unreadableCount,
    session.alignmentWarningCount,
  );
  teardownGuidedCaptureSession(operationId);
  if (activeCaptureOperation?.operationId === operationId) {
    activeCaptureOperation.state = "ready-for-review";
    activeCaptureOperation.payload = session.payload;
    activeCaptureOperation.alignmentWarningCount =
      session.alignmentWarningCount;
  }
  return summary;
}

async function finalizeAutomaticCaptureOperation(
  operationId: string,
): Promise<CaptureCollectionSummary> {
  const session = guidedCaptureSession;
  if (
    !session ||
    session.operationId !== operationId ||
    session.mode !== "automatic"
  ) {
    throw new Error("The automatic capture buffer is no longer available.");
  }
  const summary = await finalizeGuidedCaptureOperation(
    operationId,
    trimAutomaticDateBoundary,
  );
  if (summary.extractedCount === 0) {
    throw new Error(
      "No readable messages fall within the selected automatic boundary. Nothing was sent.",
    );
  }
  return summary;
}

async function collectCaptureOperation(
  operationId: string,
  mode: "loaded" | "guided" | "automatic" = "loaded",
): Promise<CaptureCollectionSummary> {
  if (
    activeCaptureOperation &&
    activeCaptureOperation.operationId !== operationId &&
    ["collecting", "ready-for-review", "uploading", "retry-required"].includes(
      activeCaptureOperation.state,
    )
  ) {
    throw new Error("Another capture operation is already active in this tab.");
  }

  const chatIdentity = getCurrentChatIdentity();
  activeCaptureOperation = {
    operationId,
    chatIdentity,
    state: "collecting",
    payload: null,
  };
  state.isExtracting = true;
  updateProgress(35);

  try {
    const payload = await extractCurrentChatWithRetry(
      EXTRACTION_CONFIG.retryAttempts,
      true,
    );
    if (!payload || payload.messages.length === 0) {
      throw new Error("No readable loaded messages were found.");
    }
    if (getCurrentChatIdentity() !== chatIdentity) {
      throw new Error(
        "The selected chat changed while messages were being read.",
      );
    }
    if (
      activeCaptureOperation?.operationId !== operationId ||
      activeCaptureOperation.state !== "collecting"
    ) {
      throw new Error(
        "The capture was cancelled while messages were being read.",
      );
    }

    activeCaptureOperation = {
      operationId,
      chatIdentity,
      state: mode === "loaded" ? "ready-for-review" : "collecting",
      payload,
    };
    if (mode !== "loaded") {
      return await startGuidedCaptureOperation(
        operationId,
        chatIdentity,
        payload,
        mode,
      );
    }
    const unreadableCount = payload.diagnostics.unreadableMessageCount;
    return summarizeCapturePayload(
      payload,
      chatIdentity,
      Math.max(
        0,
        payload.diagnostics.messageContainerCount -
          payload.messages.length -
          unreadableCount,
      ),
      unreadableCount,
      0,
    );
  } catch (error) {
    if (activeCaptureOperation?.operationId === operationId) {
      activeCaptureOperation = null;
    }
    throw error;
  } finally {
    if (
      !activeCaptureOperation ||
      activeCaptureOperation.operationId === operationId
    ) {
      state.isExtracting = false;
      updateProgress(0);
    }
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
      .map((container) =>
        findMessageRecord(container as HTMLElement).getAttribute("data-id"),
      ),
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
      } else {
        diagnostics.unreadableMessageCount += 1;
      }
    } catch (error) {
      diagnostics.unreadableMessageCount += 1;
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

  const message: ExtractedMessage = {
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
  const captureSourceId = messageRecord.getAttribute("data-id")?.trim();
  const captureAlignmentToken = JSON.stringify({
    metadata: metadata.value,
    direction: isOutgoing ? "out" : "in",
    sender: displayLabel || participantIdentity.rawDisplayName || "unknown",
    text,
    mediaType: mediaType || "none",
    timestamp:
      timestamp.method === "fallback" ? "unavailable" : timestamp.value,
  });
  Object.defineProperties(message, {
    captureSourceId: {
      value: captureSourceId || undefined,
      enumerable: false,
    },
    captureAlignmentToken: {
      value: captureAlignmentToken,
      enumerable: false,
    },
    captureMetadataPath: {
      value: metadata.path,
      enumerable: false,
    },
    captureSenderMethod: {
      value: participantIdentity.extractionMethod,
      enumerable: false,
    },
    captureTimestampMethod: {
      value: timestamp.method,
      enumerable: false,
    },
  });
  return message;
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
    unreadableMessageCount: 0,
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
      const newChatId = getCurrentChatIdentity();

      if (newChatId !== currentChatId) {
        currentChatId = newChatId;
        console.log("[ConvoLens] Chat changed");
        const operation = activeCaptureOperation;
        if (
          operation &&
          operation.chatIdentity !== newChatId &&
          operation.state !== "uploading"
        ) {
          if (guidedCaptureSession?.operationId === operation.operationId) {
            teardownGuidedCaptureSession(operation.operationId);
          }
          activeCaptureOperation = null;
          sendRuntimeLifecycleMessage({
            action: "CANCEL_CAPTURE_OPERATION",
            operationId: operation.operationId,
            reason: "The selected chat changed. Nothing was sent.",
          });
        }
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
    case "COLLECT_CAPTURE_OPERATION":
      collectCaptureOperation(message.operationId, message.mode)
        .then((summary) =>
          respondSafely(sendResponse, {
            success: true,
            data: { summary },
          }),
        )
        .catch((error) =>
          respondSafely(sendResponse, {
            success: false,
            error: normalizeErrorMessage(error),
          }),
        );
      return true;

    case "FINALIZE_GUIDED_CAPTURE_OPERATION":
      finalizeGuidedCaptureOperation(message.operationId)
        .then((summary) =>
          respondSafely(sendResponse, {
            success: true,
            data: { summary },
          }),
        )
        .catch((error) =>
          respondSafely(sendResponse, {
            success: false,
            error: normalizeErrorMessage(error),
          }),
        );
      return true;

    case "ACTIVATE_GUIDED_CAPTURE_OPERATION":
      try {
        activateGuidedCaptureOperation(message.operationId);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: normalizeErrorMessage(error) });
      }
      break;

    case "ACTIVATE_AUTOMATIC_CAPTURE_OPERATION":
      try {
        activateAutomaticCaptureOperation(
          message.operationId,
          message.boundary,
        );
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: normalizeErrorMessage(error) });
      }
      break;

    case "SET_AUTOMATIC_CAPTURE_PAUSED":
      setAutomaticCapturePaused(message.operationId, message.paused)
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({ success: false, error: normalizeErrorMessage(error) }),
        );
      return true;

    case "FINALIZE_AUTOMATIC_CAPTURE_OPERATION":
      finalizeAutomaticCaptureOperation(message.operationId)
        .then((summary) =>
          respondSafely(sendResponse, {
            success: true,
            data: { summary },
          }),
        )
        .catch((error) =>
          respondSafely(sendResponse, {
            success: false,
            error: normalizeErrorMessage(error),
          }),
        );
      return true;

    case "GET_CAPTURE_PREVIEW": {
      const preview = getCapturePreviewSummary(message.operationId);
      if (!preview) {
        sendResponse({
          success: false,
          error: "The reviewed preview is no longer available in this tab.",
        });
      } else {
        sendResponse({ success: true, data: preview });
      }
      break;
    }

    case "GET_CAPTURE_OPERATION_PAYLOAD":
      if (
        activeCaptureOperation?.operationId !== message.operationId ||
        !activeCaptureOperation.payload
      ) {
        sendResponse({
          success: false,
          error: "The reviewed capture is no longer available in this tab.",
        });
      } else {
        sendResponse({ success: true, data: activeCaptureOperation.payload });
      }
      break;

    case "VALIDATE_CAPTURE_OPERATION_CONTEXT": {
      const isCurrent =
        activeCaptureOperation?.operationId === message.operationId &&
        activeCaptureOperation.chatIdentity === getCurrentChatIdentity();
      sendResponse({ success: true, data: { isCurrent } });
      break;
    }

    case "DISCARD_CAPTURE_OPERATION":
      if (guidedCaptureSession?.operationId === message.operationId) {
        teardownGuidedCaptureSession(message.operationId);
      }
      if (activeCaptureOperation?.operationId === message.operationId) {
        activeCaptureOperation = null;
      }
      sendResponse({ success: true });
      break;

    case "CAPTURE_OPERATION_UPDATED":
      renderCaptureOperation(message.operation);
      sendResponse({ success: true });
      break;

    case "GET_CURRENT_CHAT":
      sendResponse({
        success: false,
        error: "Use the shared capture operation command.",
      });
      break;

    case "CHECK_STATUS": {
      const chatList = querySelector(
        SELECTORS.primary.chatList,
        SELECTORS.fallback.chatList,
      );
      const statusData: CheckStatusData = {
        isWhatsAppWeb: true,
        isLoggedIn: !!chatList,
        isExtracting:
          state.isExtracting ||
          Boolean(
            activeCaptureOperation &&
              ["collecting", "paused", "uploading"].includes(
                activeCaptureOperation.state,
              ),
          ),
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
      authToken = normalizeAuthToken(typedMessage.token);
      launcherCaptureAuthGeneration = typedMessage.authGeneration;
      chrome.storage.local
        .set({ [STORAGE_KEYS.authToken]: authToken })
        .catch(() => undefined);
      refreshLauncherAuthenticationState(authToken)
        .then(() => respondSafely(sendResponse, { success: true }))
        .catch((error) => {
          respondSafely(sendResponse, {
            success: false,
            error: normalizeErrorMessage(error),
          });
        });
      return true;
    }

    case "REFRESH_LAUNCHER_STATE":
      refreshLauncherFromValidatedAuthentication()
        .then(() => respondSafely(sendResponse, { success: true }))
        .catch((error) =>
          respondSafely(sendResponse, {
            success: false,
            error: normalizeErrorMessage(error),
          }),
        );
      return true;

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

function sendRuntimeLifecycleMessage(message: ExtensionMessage): void {
  try {
    chrome.runtime.sendMessage(message).catch(() => undefined);
  } catch {
    // The content-script context may already be invalidated during teardown.
  }
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
