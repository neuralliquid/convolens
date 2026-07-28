/**
 * ConvoLens Chrome Extension - Background Service Worker (Production)
 *
 * Handles all background operations for the extension:
 * - API communication with retry logic
 * - Authentication state management
 * - Explicit retry-required responses without persisting new raw captures
 * - Settings management
 * - Error tracking
 */

import {
  getConfig,
  STORAGE_KEYS,
  RATE_LIMIT_CONFIG,
  DEFAULT_SETTINGS,
  getTracingHeaders,
  type ExtensionMessage,
  type ExtensionResponse,
  type ExtensionSettings,
  type LoginMessage,
  type UpdateSettingsMessage,
  type SendChatDataMessage,
  type OpenDashboardMessage,
  type StartCaptureOperationMessage,
  type ConfirmCaptureOperationMessage,
  type CancelCaptureOperationMessage,
} from "./config";
import {
  completeCaptureOperation,
  createCaptureOperation,
  isActiveCaptureState,
  sanitizeOperationReason,
  type CaptureCollectionSummary,
  type CaptureOperationSnapshot,
} from "./capture-operation";

// =============================================================================
// Types
// =============================================================================

interface RateLimitState {
  apiCallCount: number;
  resetTime: number;
}

class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpRequestError";
  }
}

// Storage key for persistent rate limiting
const RATE_LIMIT_STORAGE_KEY = "ws_rate_limit_state";
const captureOperations = new Map<number, CaptureOperationSnapshot>();
const captureUploadPromises = new Map<
  string,
  Promise<ExtensionResponse<CaptureOperationSnapshot>>
>();
let captureOperationsLoadPromise: Promise<void> | null = null;

chrome.tabs.onRemoved.addListener((tabId) => {
  const operation = captureOperations.get(tabId);
  if (operation && isActiveCaptureState(operation.state)) {
    void finishCaptureOperation(
      operation,
      "cancelled",
      "The WhatsApp tab was closed.",
      false,
    );
  }
});

// =============================================================================
// Message Handler
// =============================================================================

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse) => void,
  ) => {
    handleMessage(message, sender)
      .then((response) => respondSafely(sendResponse, response))
      .catch((error) =>
        respondSafely(sendResponse, {
          success: false,
          error: normalizeErrorMessage(error),
        }),
      );
    return true; // Indicates async response
  },
);

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "The extension operation could not be completed.";
}

function respondSafely(
  sendResponse: (response: ExtensionResponse) => void,
  response: ExtensionResponse,
): void {
  try {
    sendResponse(response);
  } catch {
    // The popup, tab, or frame can close while an async response is pending.
  }
}

async function handleMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
): Promise<ExtensionResponse> {
  console.log("[Background] Received message:", message.action);

  switch (message.action) {
    case "START_CAPTURE_OPERATION":
      return await startCaptureOperation(message, _sender);

    case "GET_CAPTURE_OPERATION": {
      const tabId = resolveCaptureTabId(message.tabId, _sender);
      if (tabId === null) {
        return { success: false, error: "A WhatsApp tab is required." };
      }
      await loadCaptureOperations();
      return { success: true, data: captureOperations.get(tabId) };
    }

    case "CONFIRM_CAPTURE_OPERATION":
      return await confirmCaptureOperation(message, _sender);

    case "CANCEL_CAPTURE_OPERATION":
      return await cancelCaptureOperation(message, _sender);

    case "SEND_CHAT_DATA": {
      return {
        success: false,
        error: "Use the shared capture operation command.",
      };
    }

    case "OPEN_DASHBOARD": {
      const typedMessage = message as OpenDashboardMessage;
      return await openDashboard(typedMessage.path);
    }

    case "GET_AUTH_STATUS":
      return await getAuthStatus();

    case "SYNC_MYSTIRA_AUTH":
      return await syncMystiraSession();

    case "LOGIN": {
      const typedMessage = message as LoginMessage;
      // Validate required fields
      if (!typedMessage.email || !typedMessage.password) {
        return { success: false, error: "Email and password are required" };
      }
      return await handleLogin(typedMessage.email, typedMessage.password);
    }

    case "LOGOUT":
      return await handleLogout();

    case "GET_SETTINGS":
      return await getSettings();

    case "UPDATE_SETTINGS": {
      const typedMessage = message as UpdateSettingsMessage;
      if (!typedMessage.settings || typeof typedMessage.settings !== "object") {
        return { success: false, error: "Settings object is required" };
      }
      return await updateSettings(typedMessage.settings);
    }

    case "CLEAR_PENDING_UPLOADS":
      return await clearPendingUploads();

    case "GET_CURRENT_CHAT":
    case "CHECK_STATUS":
    case "SET_AUTH_TOKEN":
    case "COLLECT_CAPTURE_OPERATION":
    case "GET_CAPTURE_OPERATION_PAYLOAD":
    case "DISCARD_CAPTURE_OPERATION":
    case "CAPTURE_OPERATION_UPDATED":
      // These are handled by content script, not background
      return { success: false, error: "Action handled by content script" };

    default:
      return { success: false, error: "Unknown action" };
  }
}

// =============================================================================
// Shared capture operation lifecycle
// =============================================================================

function resolveCaptureTabId(
  requestedTabId: number | undefined,
  sender: chrome.runtime.MessageSender,
): number | null {
  if (Number.isInteger(requestedTabId)) return requestedTabId as number;
  return Number.isInteger(sender.tab?.id) ? (sender.tab?.id as number) : null;
}

async function loadCaptureOperations(): Promise<void> {
  if (captureOperationsLoadPromise) return await captureOperationsLoadPromise;
  captureOperationsLoadPromise = (async () => {
    const stored = await chrome.storage.session.get([
      STORAGE_KEYS.captureOperations,
    ]);
    const persisted = stored[STORAGE_KEYS.captureOperations];
    if (!persisted || typeof persisted !== "object") return;

    const interrupted: CaptureOperationSnapshot[] = [];
    for (const [tabIdValue, value] of Object.entries(persisted)) {
      const tabId = Number(tabIdValue);
      if (!Number.isInteger(tabId) || !value || typeof value !== "object") {
        continue;
      }
      const operation = value as CaptureOperationSnapshot;
      const restored = isActiveCaptureState(operation.state)
        ? completeCaptureOperation(
            operation,
            "cancelled",
            "The extension background restarted. Recapture and review the loaded messages.",
          )
        : operation;
      captureOperations.set(tabId, restored);
      if (restored !== operation) interrupted.push(restored);
    }
    await persistCaptureOperations();
    for (const operation of interrupted) {
      chrome.runtime
        .sendMessage({ action: "CAPTURE_OPERATION_UPDATED", operation })
        .catch(() => undefined);
      await discardCapturePayload(operation);
    }
  })();
  return await captureOperationsLoadPromise;
}

async function persistCaptureOperations(): Promise<void> {
  await chrome.storage.session.set({
    [STORAGE_KEYS.captureOperations]: Object.fromEntries(captureOperations),
  });
}

async function publishCaptureOperation(
  operation: CaptureOperationSnapshot,
  notifyTab: boolean = true,
): Promise<void> {
  captureOperations.set(operation.tabId, operation);
  await persistCaptureOperations();

  chrome.runtime
    .sendMessage({ action: "CAPTURE_OPERATION_UPDATED", operation })
    .catch(() => undefined);
  if (notifyTab) {
    chrome.tabs
      .sendMessage(operation.tabId, {
        action: "CAPTURE_OPERATION_UPDATED",
        operation,
      })
      .catch(() => undefined);
  }
}

async function startCaptureOperation(
  message: StartCaptureOperationMessage,
  sender: chrome.runtime.MessageSender,
): Promise<ExtensionResponse<CaptureOperationSnapshot>> {
  const tabId = resolveCaptureTabId(message.tabId, sender);
  if (tabId === null) {
    return {
      success: false,
      error: "Open WhatsApp Web and select a chat first.",
    };
  }
  await loadCaptureOperations();

  const existing = captureOperations.get(tabId);
  if (existing && isActiveCaptureState(existing.state)) {
    return { success: true, data: existing };
  }

  let operation = createCaptureOperation(tabId, message.initiator);
  await publishCaptureOperation(operation);
  operation = { ...operation, state: "collecting" };
  await publishCaptureOperation(operation);

  try {
    const response = (await chrome.tabs.sendMessage(tabId, {
      action: "COLLECT_CAPTURE_OPERATION",
      operationId: operation.operationId,
    })) as ExtensionResponse<{
      summary: CaptureCollectionSummary;
    }>;
    if (!response.success || !response.data?.summary) {
      return await finishCaptureOperation(
        operation,
        "cancelled",
        response.success
          ? "The loaded-message review was cancelled."
          : response.error,
      );
    }

    const summary = response.data.summary;
    operation = {
      ...operation,
      state: "ready-for-review",
      chatKey: summary.chatKey,
      renderedCount: summary.renderedCount,
      collectedCount: summary.extractedCount,
      extractedCount: summary.extractedCount,
      skippedCount: summary.skippedCount,
      mediaCount: summary.mediaCount,
      oldestTimestamp: summary.oldestTimestamp,
      newestTimestamp: summary.newestTimestamp,
      stopReason: "loaded-window",
      reason: undefined,
    };
    await publishCaptureOperation(operation);
    return { success: true, data: operation };
  } catch (error) {
    return await finishCaptureOperation(
      operation,
      "cancelled",
      normalizeChannelLifecycleReason(error),
    );
  }
}

async function confirmCaptureOperation(
  message: ConfirmCaptureOperationMessage,
  sender: chrome.runtime.MessageSender,
): Promise<ExtensionResponse<CaptureOperationSnapshot>> {
  const tabId = resolveCaptureTabId(message.tabId, sender);
  if (tabId === null) {
    return {
      success: false,
      error: "The WhatsApp tab is no longer available.",
    };
  }
  await loadCaptureOperations();
  const operation = captureOperations.get(tabId);
  if (!operation || operation.operationId !== message.operationId) {
    return {
      success: false,
      error: "This capture operation is no longer current.",
    };
  }
  if (
    operation.state !== "ready-for-review" &&
    operation.state !== "retry-required"
  ) {
    return { success: true, data: operation };
  }

  const inFlight = captureUploadPromises.get(operation.operationId);
  if (inFlight) return await inFlight;

  const upload = uploadCaptureOperation(operation).finally(() => {
    captureUploadPromises.delete(operation.operationId);
  });
  captureUploadPromises.set(operation.operationId, upload);
  return await upload;
}

async function uploadCaptureOperation(
  initialOperation: CaptureOperationSnapshot,
): Promise<ExtensionResponse<CaptureOperationSnapshot>> {
  let operation: CaptureOperationSnapshot = {
    ...initialOperation,
    state: "uploading",
    reason: undefined,
  };
  await publishCaptureOperation(operation);

  try {
    const payloadResponse = (await chrome.tabs.sendMessage(operation.tabId, {
      action: "GET_CAPTURE_OPERATION_PAYLOAD",
      operationId: operation.operationId,
    })) as ExtensionResponse<SendChatDataMessage["data"]>;
    if (!payloadResponse.success || !payloadResponse.data) {
      return await finishCaptureOperation(
        operation,
        "cancelled",
        payloadResponse.success
          ? "The reviewed capture is no longer available in this tab."
          : payloadResponse.error,
      );
    }

    const uploadResult = await sendChatData(payloadResponse.data);
    if (!uploadResult.success) {
      if (uploadResult.retryRequired) {
        operation = {
          ...operation,
          state: "retry-required",
          reason: sanitizeOperationReason(uploadResult.error),
        };
        await publishCaptureOperation(operation);
        return { success: true, data: operation };
      }
      return await finishCaptureOperation(
        operation,
        "failed",
        safeUploadFailureReason(uploadResult.error),
      );
    }

    const result = uploadResult.data as {
      duplicate?: boolean;
      reconciliationRequired?: boolean;
      data?: { dashboardUrl?: string };
    };
    const duplicate = Boolean(result?.duplicate);
    operation = completeCaptureOperation(
      {
        ...operation,
        reconciliationRequired: Boolean(result?.reconciliationRequired),
        resultPath: result?.data?.dashboardUrl,
      },
      duplicate ? "duplicate" : "received",
    );
    await publishCaptureOperation(operation);
    await discardCapturePayload(operation);
    return { success: true, data: operation };
  } catch (error) {
    return await finishCaptureOperation(
      operation,
      "cancelled",
      normalizeChannelLifecycleReason(error),
    );
  }
}

async function cancelCaptureOperation(
  message: CancelCaptureOperationMessage,
  sender: chrome.runtime.MessageSender,
): Promise<ExtensionResponse<CaptureOperationSnapshot>> {
  const tabId = resolveCaptureTabId(message.tabId, sender);
  if (tabId === null) {
    return {
      success: false,
      error: "The WhatsApp tab is no longer available.",
    };
  }
  await loadCaptureOperations();
  const operation = captureOperations.get(tabId);
  if (!operation || operation.operationId !== message.operationId) {
    return {
      success: false,
      error: "This capture operation is no longer current.",
    };
  }
  if (operation.state === "uploading") {
    return { success: true, data: operation };
  }
  if (!isActiveCaptureState(operation.state)) {
    return { success: true, data: operation };
  }
  return await finishCaptureOperation(
    operation,
    "cancelled",
    safeCancellationReason(message.reason),
  );
}

function safeCancellationReason(reason: string | undefined): string {
  const allowed = new Set([
    "Upload cancelled. Nothing was sent.",
    "The selected chat changed. Nothing was sent.",
    "The WhatsApp tab unloaded during capture.",
  ]);
  return reason && allowed.has(reason)
    ? reason
    : "Capture cancelled. Nothing was sent.";
}

function safeUploadFailureReason(reason: string): string {
  return /authentication expired|log in again/i.test(reason)
    ? "Authentication expired. Sign in again, then recapture and review the loaded messages."
    : "ConvoLens could not receive this capture. Recapture and review the loaded messages before trying again.";
}

async function finishCaptureOperation(
  operation: CaptureOperationSnapshot,
  state: "failed" | "cancelled",
  reason: unknown,
  notifyTab: boolean = true,
): Promise<ExtensionResponse<CaptureOperationSnapshot>> {
  const completed = completeCaptureOperation(
    operation,
    state,
    sanitizeOperationReason(reason),
  );
  await publishCaptureOperation(completed, notifyTab);
  if (notifyTab) await discardCapturePayload(completed);
  return { success: true, data: completed };
}

async function discardCapturePayload(
  operation: CaptureOperationSnapshot,
): Promise<void> {
  await chrome.tabs
    .sendMessage(operation.tabId, {
      action: "DISCARD_CAPTURE_OPERATION",
      operationId: operation.operationId,
    })
    .catch(() => undefined);
}

function normalizeChannelLifecycleReason(error: unknown): string {
  const message = normalizeErrorMessage(error);
  if (
    /message port closed|receiving end does not exist|context invalidated|tab was closed|no tab with id/i.test(
      message,
    )
  ) {
    return "The extension channel closed. Recapture and review the loaded messages.";
  }
  return message;
}

// =============================================================================
// API Communication
// =============================================================================

/**
 * Send chat data to the API with retry logic
 */
async function sendChatData(chatData: any): Promise<ExtensionResponse> {
  try {
    let stored = await chrome.storage.local.get([
      STORAGE_KEYS.authToken,
      STORAGE_KEYS.authTokenExpiresAt,
    ]);
    const expiresAt = Number(stored[STORAGE_KEYS.authTokenExpiresAt] || 0);
    if (
      !stored[STORAGE_KEYS.authToken] ||
      (expiresAt > 0 && expiresAt <= Date.now() + 30_000)
    ) {
      const syncResult = await syncMystiraSession();
      if (!syncResult.success) {
        return syncResult;
      }
      stored = await chrome.storage.local.get([STORAGE_KEYS.authToken]);
    }

    // Check rate limiting (persistent across service worker restarts)
    const canProceed = await checkApiRateLimit();
    if (!canProceed) {
      return {
        success: false,
        code: "retry-required",
        retryRequired: true,
        error:
          "Upload not sent because the extension is rate limited. Retry from this WhatsApp tab after reviewing the loaded messages again.",
      };
    }

    // Send with retry (include tracing headers for distributed tracing)
    const config = await getApiConfig();
    const result = await fetchWithRetry(
      `${config.apiUrl}/api/chat-export/extension`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${stored[STORAGE_KEYS.authToken]}`,
          ...getTracingHeaders(),
        },
        body: JSON.stringify(chatData),
      },
    );

    // Track successful upload in history
    await trackExtractionHistory(chatData);

    return { success: true, data: result };
  } catch (error) {
    console.error("[Background] Send failed; recapture is required");

    if (isNetworkError(error) || isRateLimitError(error)) {
      return {
        success: false,
        code: "retry-required",
        retryRequired: true,
        error:
          "Upload not sent. Retry from this WhatsApp tab after reviewing the loaded messages again.",
      };
    }

    return { success: false, error: normalizeErrorMessage(error) };
  }
}

/**
 * Fetch with retry and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 2,
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 60000);

    try {
      // Track API call count persistently
      await incrementApiCallCount();

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `HTTP ${response.status}` }));

        // Don't retry on auth errors
        if (response.status === 401 || response.status === 403) {
          // This path can run inside a capture upload, so it must not wait for
          // the upload promise that is currently executing.
          await clearAuthenticationState();
          throw new Error("Authentication expired. Please log in again.");
        }

        // Don't retry on client errors (except rate limiting)
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          throw new HttpRequestError(
            errorData.message || `Request failed: ${response.status}`,
            response.status,
          );
        }

        throw new HttpRequestError(
          errorData.message || `Request failed: ${response.status}`,
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      const normalizedError = didTimeout
        ? Object.assign(
            new Error(
              "ConvoLens took too long to respond. The upload was not sent.",
            ),
            { name: "TimeoutError" },
          )
        : (error as Error);
      lastError = normalizedError;
      console.warn(
        `[Background] Fetch attempt ${attempt + 1} failed:`,
        normalizedError,
      );

      // Authentication failures cannot recover through retries.
      if (normalizedError.message.includes("Authentication")) {
        throw normalizedError;
      }

      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error("Request failed after all retries");
}

function isNetworkError(error: any): boolean {
  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error.name === "TypeError" ||
    error.message?.includes("fetch") ||
    error.message?.includes("network") ||
    error.message?.includes("offline")
  );
}

function isRateLimitError(error: unknown): boolean {
  return error instanceof HttpRequestError && error.status === 429;
}

// =============================================================================
// Authentication
// =============================================================================

async function getAuthStatus(): Promise<ExtensionResponse> {
  let stored = await chrome.storage.local.get([
    STORAGE_KEYS.authToken,
    STORAGE_KEYS.authTokenExpiresAt,
    STORAGE_KEYS.user,
  ]);
  const expiresAt = Number(stored[STORAGE_KEYS.authTokenExpiresAt] || 0);
  if (
    !stored[STORAGE_KEYS.authToken] ||
    (expiresAt > 0 && expiresAt <= Date.now() + 30_000)
  ) {
    await syncMystiraSession();
    stored = await chrome.storage.local.get([
      STORAGE_KEYS.authToken,
      STORAGE_KEYS.user,
    ]);
  }

  return {
    success: true,
    data: {
      isAuthenticated: !!stored[STORAGE_KEYS.authToken],
      user: stored[STORAGE_KEYS.user],
    },
  };
}

async function syncMystiraSession(): Promise<ExtensionResponse> {
  try {
    const config = getConfig();
    const sessionResponse = await fetch(
      `${config.dashboardUrl}/api/auth/session`,
      {
        credentials: "include",
        cache: "no-store",
      },
    );

    if (!sessionResponse.ok) {
      return {
        success: false,
        error: "Could not read the ConvoLens sign-in session.",
      };
    }

    const session = await sessionResponse.json();
    if (!session?.user || typeof session.idToken !== "string") {
      return {
        success: false,
        error:
          "Not authenticated. Sign in to ConvoLens with Mystira Identity first.",
      };
    }

    const apiConfig = await getApiConfig();
    const exchangeResponse = await fetch(
      `${apiConfig.apiUrl}/api/auth/mystira/exchange`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getTracingHeaders(),
        },
        body: JSON.stringify({ idToken: session.idToken }),
      },
    );

    if (!exchangeResponse.ok) {
      return {
        success: false,
        error: "ConvoLens could not authorize the Mystira Identity session.",
      };
    }

    const exchanged = await exchangeResponse.json();
    if (
      typeof exchanged.token !== "string" ||
      typeof exchanged.expiresIn !== "number" ||
      !exchanged.user
    ) {
      return {
        success: false,
        error: "ConvoLens returned an invalid extension session.",
      };
    }

    await chrome.storage.local.set({
      [STORAGE_KEYS.authToken]: exchanged.token,
      [STORAGE_KEYS.authTokenExpiresAt]:
        Date.now() + exchanged.expiresIn * 1000,
      [STORAGE_KEYS.user]: exchanged.user,
    });
    await notifyContentScripts(exchanged.token);

    return {
      success: true,
      data: {
        isAuthenticated: true,
        user: exchanged.user,
      },
    };
  } catch (error) {
    console.error("[Background] Mystira session sync failed:", error);
    return {
      success: false,
      error:
        "Unable to connect the extension to the ConvoLens sign-in session.",
    };
  }
}

async function notifyContentScripts(token: string | null): Promise<void> {
  const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
  await Promise.all(
    tabs.map((tab) =>
      tab.id
        ? chrome.tabs
            .sendMessage(tab.id, { action: "SET_AUTH_TOKEN", token })
            .catch(() => undefined)
        : Promise.resolve(),
    ),
  );
}

async function handleLogin(
  email: string,
  password: string,
): Promise<ExtensionResponse> {
  try {
    const config = await getApiConfig();

    const response = await fetch(`${config.apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Login failed" }));
      return { success: false, error: error.message };
    }

    const { token, user } = await response.json();

    await chrome.storage.local.set({
      [STORAGE_KEYS.authToken]: token,
      [STORAGE_KEYS.user]: user,
    });

    await notifyContentScripts(token);

    return { success: true, data: { user } };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function handleLogout(): Promise<ExtensionResponse> {
  await clearCaptureOperationsForLogout();
  await clearAuthenticationState();

  return { success: true };
}

async function clearAuthenticationState(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.authToken,
    STORAGE_KEYS.authTokenExpiresAt,
    STORAGE_KEYS.user,
  ]);
  await notifyContentScripts(null);
}

async function clearCaptureOperationsForLogout(): Promise<void> {
  await loadCaptureOperations();

  // An upload already carries the current account's authorization and cannot
  // be truthfully undone. Let it settle before clearing that account, then
  // remove every old-account snapshot and in-tab reviewed payload.
  await Promise.allSettled([...captureUploadPromises.values()]);

  for (const operation of [...captureOperations.values()]) {
    if (isActiveCaptureState(operation.state)) {
      await finishCaptureOperation(
        operation,
        "cancelled",
        "Sign-out cancelled the reviewed capture. Nothing new was sent.",
      );
    } else {
      await discardCapturePayload(operation);
    }
  }
  captureOperations.clear();
  await persistCaptureOperations();
}

// =============================================================================
// Settings Management
// =============================================================================

async function getSettings(): Promise<ExtensionResponse> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.settings]);
  const settings = { ...DEFAULT_SETTINGS, ...stored[STORAGE_KEYS.settings] };
  return { success: true, data: settings };
}

async function updateSettings(
  newSettings: Partial<ExtensionSettings>,
): Promise<ExtensionResponse> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.settings]);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...stored[STORAGE_KEYS.settings],
    ...newSettings,
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
  return { success: true, data: settings };
}

async function getApiConfig() {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.settings]);
  const settings = stored[STORAGE_KEYS.settings] || {};
  const config = getConfig();

  // Allow custom API endpoint
  if (settings.apiEndpoint) {
    return { ...config, apiUrl: settings.apiEndpoint };
  }

  return config;
}

// =============================================================================
// Legacy Pending Upload Migration
// =============================================================================

async function clearPendingUploads(): Promise<ExtensionResponse> {
  await chrome.storage.local.remove(STORAGE_KEYS.pendingUploads);
  return { success: true };
}

// =============================================================================
// Extraction History
// =============================================================================

async function trackExtractionHistory(chatData: any): Promise<void> {
  try {
    const stored = await chrome.storage.local.get([
      STORAGE_KEYS.extractionHistory,
    ]);
    const history = stored[STORAGE_KEYS.extractionHistory] || [];

    history.unshift({
      chatName: chatData.chatName,
      messageCount: chatData.messageCount,
      extractedAt: chatData.extractedAt,
    });

    // Keep only last 100 entries
    while (history.length > 100) {
      history.pop();
    }

    await chrome.storage.local.set({
      [STORAGE_KEYS.extractionHistory]: history,
    });
  } catch (error) {
    console.error("[Background] Failed to track history:", error);
  }
}

// =============================================================================
// Rate Limiting (Persistent across service worker restarts)
// =============================================================================

/**
 * Get rate limit state from persistent storage
 */
async function getRateLimitState(): Promise<RateLimitState> {
  const stored = await chrome.storage.local.get([RATE_LIMIT_STORAGE_KEY]);
  const state = stored[RATE_LIMIT_STORAGE_KEY] as RateLimitState | undefined;

  const now = Date.now();

  // Return existing state or create new one
  if (state && now < state.resetTime) {
    return state;
  }

  // Reset if expired or doesn't exist
  return {
    apiCallCount: 0,
    resetTime: now + 60000, // 1 minute window
  };
}

/**
 * Increment API call count with persistence
 */
async function incrementApiCallCount(): Promise<void> {
  const state = await getRateLimitState();
  state.apiCallCount++;
  await chrome.storage.local.set({ [RATE_LIMIT_STORAGE_KEY]: state });
}

/**
 * Check if API rate limit allows another call (persistent)
 */
async function checkApiRateLimit(): Promise<boolean> {
  const state = await getRateLimitState();
  return state.apiCallCount < RATE_LIMIT_CONFIG.maxApiCallsPerMinute;
}

// =============================================================================
// Dashboard & Navigation
// =============================================================================

async function openDashboard(path?: string): Promise<ExtensionResponse> {
  const config = await getApiConfig();
  const url = `${config.dashboardUrl}${path || "/dashboard"}`;
  await chrome.tabs.create({ url });
  return { success: true };
}

// =============================================================================
// Installation & Lifecycle
// =============================================================================

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[Background] Extension installed:", details.reason);

  if (details.reason === "install") {
    // Initialize default settings
    await chrome.storage.local.set({
      [STORAGE_KEYS.settings]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.pendingUploads]: [],
      [STORAGE_KEYS.extractionHistory]: [],
    });

    // Open welcome page
    const config = getConfig();
    await chrome.tabs.create({
      url: `${config.dashboardUrl}/extension-welcome`,
    });
  }
});

console.log("[Background] Service worker initialized");
