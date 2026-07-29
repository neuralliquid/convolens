import type {
  AutomaticCaptureBoundary,
  CaptureStopReason,
} from "./capture-operation";

export const AUTOMATIC_CAPTURE_SAFETY_CAP = 500;
export const AUTOMATIC_NO_PROGRESS_LIMIT = 3;

export function normalizeAutomaticBoundary(
  value: AutomaticCaptureBoundary | undefined,
): AutomaticCaptureBoundary {
  if (value?.kind === "days" && (value.days === 7 || value.days === 30)) {
    return value;
  }
  if (value?.kind === "messages") {
    return {
      kind: "messages",
      messageLimit: Math.max(
        1,
        Math.min(
          AUTOMATIC_CAPTURE_SAFETY_CAP,
          Math.floor(value.messageLimit || AUTOMATIC_CAPTURE_SAFETY_CAP),
        ),
      ),
    };
  }
  return { kind: "verified-top" };
}

export function automaticDateCutoff(
  boundary: AutomaticCaptureBoundary,
  startedAt: Date,
): number | null {
  if (boundary.kind !== "days") return null;
  return startedAt.getTime() - boundary.days * 24 * 60 * 60 * 1_000;
}

export function automaticDateBoundaryStartIndex(
  trustedTimestamps: Array<string | undefined>,
  boundary: AutomaticCaptureBoundary,
  startedAt: Date,
): number | null {
  const cutoff = automaticDateCutoff(boundary, startedAt);
  if (cutoff === null) return null;
  let lastExcludedIndex = -1;
  for (const [index, timestamp] of trustedTimestamps.entries()) {
    const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
    if (Number.isFinite(parsed) && parsed <= cutoff) {
      lastExcludedIndex = index;
    }
  }
  return lastExcludedIndex < 0 ? null : lastExcludedIndex + 1;
}

export function automaticBoundaryStopReason(options: {
  boundary: AutomaticCaptureBoundary;
  extractedCount: number;
  oldestTrustedTimestamp?: string;
  verifiedTop: boolean;
  startedAt: Date;
}): CaptureStopReason | null {
  if (
    options.boundary.kind === "messages" &&
    options.extractedCount >= options.boundary.messageLimit
  ) {
    return options.boundary.messageLimit >= AUTOMATIC_CAPTURE_SAFETY_CAP
      ? "automatic-safety-cap"
      : "automatic-message-limit";
  }
  if (options.boundary.kind === "days") {
    const oldest = options.oldestTrustedTimestamp
      ? Date.parse(options.oldestTrustedTimestamp)
      : Number.NaN;
    const cutoff = automaticDateCutoff(options.boundary, options.startedAt);
    if (cutoff !== null && Number.isFinite(oldest) && oldest <= cutoff) {
      return "automatic-date-boundary";
    }
  }
  if (options.extractedCount >= AUTOMATIC_CAPTURE_SAFETY_CAP) {
    return "automatic-safety-cap";
  }
  if (options.verifiedTop) {
    return "automatic-verified-top";
  }
  return null;
}
