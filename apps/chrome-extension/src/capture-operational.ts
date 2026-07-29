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

export interface StoredCaptureOperationalState extends CaptureOperationalState {
  ownerId: string;
}

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
  if (!value || typeof value !== "object") {
    return { preferredMode: "loaded" };
  }
  const candidate = value as Partial<StoredCaptureOperationalState>;
  if (candidate.ownerId !== ownerId) {
    return { preferredMode: "loaded" };
  }
  return {
    preferredMode: normalizeCaptureMode(candidate.preferredMode),
    lastCapture: normalizeLastCapture(candidate.lastCapture),
  };
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
        operation.state === "cancelled" ||
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
