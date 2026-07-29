export type CaptureOperationState =
  | "idle"
  | "inspecting"
  | "collecting"
  | "paused"
  | "ready-for-review"
  | "uploading"
  | "received"
  | "duplicate"
  | "retry-required"
  | "failed"
  | "cancelled";

export type CaptureOperationInitiator = "popup" | "page";
export type CaptureOperationMode = "loaded" | "guided" | "automatic";
export type AutomaticCaptureBoundary =
  | { kind: "days"; days: 7 | 30 }
  | { kind: "messages"; messageLimit: number }
  | { kind: "verified-top" };
export type CaptureStopReason =
  | "loaded-window"
  | "guided-user-stopped"
  | "guided-safety-limit"
  | "guided-timeout"
  | "guided-dom-failure"
  | "automatic-user-stopped"
  | "automatic-date-boundary"
  | "automatic-message-limit"
  | "automatic-verified-top"
  | "automatic-safety-cap"
  | "automatic-no-progress"
  | "automatic-dom-failure";

export interface CaptureOperationSnapshot {
  operationId: string;
  authGeneration: number;
  tabId: number;
  initiator: CaptureOperationInitiator;
  mode: CaptureOperationMode;
  automaticBoundary?: AutomaticCaptureBoundary;
  automaticControlsReady?: boolean;
  state: CaptureOperationState;
  chatKey?: string;
  renderedCount: number;
  collectedCount: number;
  extractedCount: number;
  skippedCount: number;
  unreadableCount: number;
  participantLabelCount: number;
  alignmentWarningCount: number;
  mediaCount: number;
  oldestTimestamp?: string;
  oldestTrustedTimestamp?: string;
  newestTimestamp?: string;
  stopReason?: CaptureStopReason;
  resultPath?: string;
  reconciliationRequired?: boolean;
  reason?: string;
  startedAt: string;
  completedAt?: string;
}

export interface CaptureCollectionSummary {
  chatKey: string;
  renderedCount: number;
  extractedCount: number;
  skippedCount: number;
  unreadableCount: number;
  participantLabelCount: number;
  alignmentWarningCount: number;
  mediaCount: number;
  oldestTimestamp?: string;
  oldestTrustedTimestamp?: string;
  newestTimestamp?: string;
}

const TERMINAL_STATES = new Set<CaptureOperationState>([
  "received",
  "duplicate",
  "failed",
  "cancelled",
]);

export function isTerminalCaptureState(state: CaptureOperationState): boolean {
  return TERMINAL_STATES.has(state);
}

export function isActiveCaptureState(state: CaptureOperationState): boolean {
  return state !== "idle" && !isTerminalCaptureState(state);
}

export function createCaptureOperation(
  tabId: number,
  initiator: CaptureOperationInitiator,
  now: Date = new Date(),
  authGeneration: number = 0,
  mode: CaptureOperationMode = "loaded",
): CaptureOperationSnapshot {
  return {
    operationId: crypto.randomUUID(),
    authGeneration,
    tabId,
    initiator,
    mode,
    state: "inspecting",
    renderedCount: 0,
    collectedCount: 0,
    extractedCount: 0,
    skippedCount: 0,
    unreadableCount: 0,
    participantLabelCount: 0,
    alignmentWarningCount: 0,
    mediaCount: 0,
    startedAt: now.toISOString(),
  };
}

export function completeCaptureOperation(
  operation: CaptureOperationSnapshot,
  state: Extract<
    CaptureOperationState,
    "received" | "duplicate" | "failed" | "cancelled"
  >,
  reason?: string,
  now: Date = new Date(),
): CaptureOperationSnapshot {
  return {
    ...operation,
    state,
    reason: reason ? sanitizeOperationReason(reason) : undefined,
    completedAt: now.toISOString(),
  };
}

export function sanitizeOperationReason(reason: unknown): string {
  const value =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "The capture operation could not be completed.";
  return value
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 240);
}
