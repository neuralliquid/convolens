import type {
  CaptureOperationMode,
  CaptureOperationSnapshot,
} from "./capture-operation";

export interface LastCaptureSummary {
  count: number;
  completedAt: string;
  state: "received" | "duplicate";
  resultPath?: string;
  reconciliationRequired: boolean;
}

export interface CaptureOperationalState {
  preferredMode: CaptureOperationMode;
  lastCapture?: LastCaptureSummary;
}

export type StoredCaptureOperationalStates = Record<
  string,
  CaptureOperationalState
>;

export interface ToolbarBadgeState {
  text: "" | "!";
  color: string;
  title: string;
}

export function normalizeCaptureMode(value: unknown): CaptureOperationMode {
  return value === "guided" || value === "automatic" ? value : "loaded";
}

export function normalizeConversationResultPath(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^\/dashboard\/conversations\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    trimmed,
  )
    ? trimmed
    : undefined;
}

function normalizeLastCapture(value: unknown): LastCaptureSummary | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<LastCaptureSummary>;
  if (
    !Number.isInteger(candidate.count) ||
    (candidate.count ?? -1) < 0 ||
    typeof candidate.completedAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.completedAt)) ||
    (candidate.state !== "received" && candidate.state !== "duplicate")
  ) {
    return undefined;
  }
  return {
    count: candidate.count as number,
    completedAt: candidate.completedAt,
    state: candidate.state,
    resultPath: normalizeConversationResultPath(candidate.resultPath),
    reconciliationRequired: Boolean(candidate.reconciliationRequired),
  };
}

export function operationalStateForOwner(
  value: unknown,
  ownerId: string,
): CaptureOperationalState {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !Object.prototype.hasOwnProperty.call(value, ownerId)
  ) {
    return { preferredMode: "loaded" };
  }
  const candidate = (value as Record<string, unknown>)[ownerId];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { preferredMode: "loaded" };
  }
  const state = candidate as Partial<CaptureOperationalState>;
  return {
    preferredMode: normalizeCaptureMode(state.preferredMode),
    lastCapture: normalizeLastCapture(state.lastCapture),
  };
}

export function withOperationalStateForOwner(
  value: unknown,
  ownerId: string,
  state: CaptureOperationalState,
): StoredCaptureOperationalStates {
  const records: StoredCaptureOperationalStates = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [storedOwnerId, candidate] of Object.entries(value)) {
      if (
        candidate &&
        typeof candidate === "object" &&
        !Array.isArray(candidate)
      ) {
        records[storedOwnerId] = operationalStateForOwner(value, storedOwnerId);
      }
    }
  }
  records[ownerId] = {
    preferredMode: normalizeCaptureMode(state.preferredMode),
    lastCapture: normalizeLastCapture(state.lastCapture),
  };
  return records;
}

export function canRestoreReviewedRetry(
  operation: CaptureOperationSnapshot,
  persistedOwnerId: unknown,
  currentOwnerId: unknown,
): boolean {
  return (
    operation.state === "retry-required" &&
    typeof persistedOwnerId === "string" &&
    persistedOwnerId === currentOwnerId
  );
}

export function captureOwnerMatches(
  persistedOwnerId: unknown,
  currentOwnerId: unknown,
): boolean {
  return (
    typeof persistedOwnerId === "string" && persistedOwnerId === currentOwnerId
  );
}

export function deriveToolbarBadge(
  operations: Iterable<CaptureOperationSnapshot>,
  legacyQueueCount: number,
): ToolbarBadgeState {
  const values = [...operations];
  if (values.some((operation) => operation.state === "retry-required")) {
    return {
      text: "!",
      color: "#b42318",
      title: "ConvoLens: reviewed capture needs retry",
    };
  }
  if (legacyQueueCount > 0) {
    return {
      text: "!",
      color: "#b54708",
      title: "ConvoLens: legacy captures need export or deletion",
    };
  }
  if (
    values.some(
      (operation) =>
        operation.state === "ready-for-review" ||
        operation.state === "failed" ||
        Boolean(operation.reconciliationRequired),
    )
  ) {
    return {
      text: "!",
      color: "#175cd3",
      title: "ConvoLens: capture needs attention",
    };
  }
  return { text: "", color: "#175cd3", title: "ConvoLens" };
}
