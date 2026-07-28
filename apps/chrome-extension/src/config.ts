/**
 * Chrome Extension Configuration
 *
 * Production-ready configuration management for the ConvoLens extension.
 * Supports both development and production environments.
 */

// API Configuration
export const API_CONFIG = {
  // Production URLs (updated during build)
  production: {
    apiUrl:
      "https://nl-prod-convolens-api.calmmoss-612abacc.southafricanorth.azurecontainerapps.io",
    wsUrl:
      "wss://nl-prod-convolens-api.calmmoss-612abacc.southafricanorth.azurecontainerapps.io/ws",
    dashboardUrl: "https://convolens.neuralliquid.ai",
  },
  // Development URLs
  development: {
    apiUrl: "http://localhost:3001",
    wsUrl: "ws://localhost:3001/ws",
    dashboardUrl: "http://localhost:3000",
  },
};

// Chrome does not expose a reliable runtime distinction between an unpacked
// production install and an unpacked developer build. Use production by default
// so the documented "Load unpacked" path works for operators.
export function getConfig() {
  return API_CONFIG.production;
}

// WhatsApp Web DOM Selectors
// These may need updates as WhatsApp changes their UI
export const SELECTORS = {
  // Primary selectors (data-testid based - most stable)
  primary: {
    chatList: '[data-testid="chat-list"]',
    messageList: '[data-testid="conversation-panel-messages"]',
    messageContainer: '[data-testid="msg-container"]',
    messageText: '[data-testid="msg-text"]',
    messageTime: '[data-testid="msg-meta"]',
    senderName: '[data-testid="msg-sender"]',
    chatHeader: '[data-testid="conversation-header"]',
    contactName: '[data-testid="conversation-info-header-chat-title"]',
    scrollableMessageList: '[data-testid="conversation-panel-body"]',
  },
  // Fallback selectors (class-based - less stable)
  fallback: {
    chatList:
      '#pane-side, [aria-label="Chat list"], .copyable-area [role="listitem"]',
    messageList: ".message-list",
    messageContainer: ".message-in, .message-out",
    messageText: ".selectable-text.copyable-text[dir]",
    messageTime: '.copyable-text span[dir="auto"]',
    senderName: 'span[dir="auto"]._ahxt',
    chatHeader: "header._ao8g",
    contactName: 'span[dir="auto"]._ao3e',
    scrollableMessageList: "._asmz",
  },
};

// Extraction configuration
export const EXTRACTION_CONFIG = {
  // Delay between message extractions to avoid rate limiting
  extractionDelayMs: 50,
  // Maximum messages to extract in one batch
  maxMessagesPerBatch: 500,
  // Timeout for extraction operations
  extractionTimeoutMs: 30000,
  // Retry configuration
  retryAttempts: 3,
  retryDelayMs: 1000,
};

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  // Maximum extractions per minute
  maxExtractionsPerMinute: 5,
  // Maximum API calls per minute
  maxApiCallsPerMinute: 10,
  // Cooldown period after rate limit hit
  cooldownMs: 60000,
};

// Storage keys
export const STORAGE_KEYS = {
  authToken: "authToken",
  authTokenExpiresAt: "authTokenExpiresAt",
  user: "user",
  settings: "settings",
  extractionHistory: "extractionHistory",
  pendingUploads: "pendingUploads",
  captureOperations: "captureOperations",
};

// =============================================================================
// Correlation ID Generation
// =============================================================================

/**
 * Generate a unique correlation ID for tracing requests
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 14);
  return `ext_${timestamp}_${random}`;
}

/**
 * Get headers to include with API requests for tracing
 */
export function getTracingHeaders(): Record<string, string> {
  return {
    "x-correlation-id": generateCorrelationId(),
    "x-source": "chrome-extension",
    "x-extension-version": chrome.runtime.getManifest().version,
  };
}

// Default settings
export interface ExtensionSettings {
  autoExtract: boolean;
  showNotifications: boolean;
  extractMediaMetadata: boolean;
  maxStoredExtractions: number;
  theme: "light" | "dark" | "auto";
  apiEndpoint: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  autoExtract: false,
  showNotifications: true,
  extractMediaMetadata: true,
  maxStoredExtractions: 50,
  theme: "auto",
  apiEndpoint: "",
};

// Message types for extension communication - Discriminated union for type safety

export interface GetCurrentChatMessage {
  action: "GET_CURRENT_CHAT";
}

export interface CheckStatusMessage {
  action: "CHECK_STATUS";
}

export interface SetAuthTokenMessage {
  action: "SET_AUTH_TOKEN";
  token: string | null;
}

export interface SendChatDataMessage {
  action: "SEND_CHAT_DATA";
  data: {
    chatName: string;
    chatId: string;
    sourceConversationId?: string;
    extractedAt: string;
    messageCount: number;
    messages: Array<{
      id: string;
      text: string;
      sender: string;
      timestamp: string;
      isOutgoing: boolean;
      isMedia: boolean;
      mediaType?: "image" | "video" | "audio" | "document" | "sticker";
      replyTo?: string;
    }>;
    source: "chrome-extension";
    version: string;
    isGroup: boolean;
  };
}

export interface StartCaptureOperationMessage {
  action: "START_CAPTURE_OPERATION";
  tabId?: number;
  initiator: "popup" | "page";
}

export interface GetCaptureOperationMessage {
  action: "GET_CAPTURE_OPERATION";
  tabId?: number;
}

export interface ConfirmCaptureOperationMessage {
  action: "CONFIRM_CAPTURE_OPERATION";
  tabId?: number;
  operationId: string;
}

export interface CancelCaptureOperationMessage {
  action: "CANCEL_CAPTURE_OPERATION";
  tabId?: number;
  operationId: string;
  reason?: string;
}

export interface CollectCaptureOperationMessage {
  action: "COLLECT_CAPTURE_OPERATION";
  operationId: string;
}

export interface GetCaptureOperationPayloadMessage {
  action: "GET_CAPTURE_OPERATION_PAYLOAD";
  operationId: string;
}

export interface DiscardCaptureOperationMessage {
  action: "DISCARD_CAPTURE_OPERATION";
  operationId: string;
}

export interface CaptureOperationUpdatedMessage {
  action: "CAPTURE_OPERATION_UPDATED";
  operation: import("./capture-operation").CaptureOperationSnapshot;
}

export interface OpenDashboardMessage {
  action: "OPEN_DASHBOARD";
  path?: string;
}

export interface GetAuthStatusMessage {
  action: "GET_AUTH_STATUS";
}

export interface SyncMystiraAuthMessage {
  action: "SYNC_MYSTIRA_AUTH";
}

export interface LoginMessage {
  action: "LOGIN";
  email: string;
  password: string;
}

export interface LogoutMessage {
  action: "LOGOUT";
}

export interface GetSettingsMessage {
  action: "GET_SETTINGS";
}

export interface UpdateSettingsMessage {
  action: "UPDATE_SETTINGS";
  settings: Partial<ExtensionSettings>;
}

export interface ClearPendingUploadsMessage {
  action: "CLEAR_PENDING_UPLOADS";
}

// Union type of all message types
export type ExtensionMessage =
  | GetCurrentChatMessage
  | CheckStatusMessage
  | SetAuthTokenMessage
  | SendChatDataMessage
  | StartCaptureOperationMessage
  | GetCaptureOperationMessage
  | ConfirmCaptureOperationMessage
  | CancelCaptureOperationMessage
  | CollectCaptureOperationMessage
  | GetCaptureOperationPayloadMessage
  | DiscardCaptureOperationMessage
  | CaptureOperationUpdatedMessage
  | OpenDashboardMessage
  | GetAuthStatusMessage
  | SyncMystiraAuthMessage
  | LoginMessage
  | LogoutMessage
  | GetSettingsMessage
  | UpdateSettingsMessage
  | ClearPendingUploadsMessage;

// Helper type to extract action names
export type MessageAction = ExtensionMessage["action"];

// Response types with proper typing
export interface SuccessResponse<T = unknown> {
  success: true;
  data?: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: "retry-required" | "channel-closed";
  retryRequired?: boolean;
}

export type ExtensionResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// Specific response data types
export interface AuthStatusData {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface CheckStatusData {
  isWhatsAppWeb: boolean;
  isLoggedIn: boolean;
  isExtracting: boolean;
}
