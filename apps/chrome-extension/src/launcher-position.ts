export type LauncherEdge = "left" | "right";
export type LauncherPreset = "upper" | "middle" | "lower";

export interface LauncherPosition {
  edge: LauncherEdge;
  preset: LauncherPreset;
}

export const DEFAULT_LAUNCHER_POSITION: LauncherPosition = {
  edge: "right",
  preset: "middle",
};

export function normalizeLauncherPosition(value: unknown): LauncherPosition {
  if (!value || typeof value !== "object") return DEFAULT_LAUNCHER_POSITION;
  const candidate = value as Partial<LauncherPosition>;
  return {
    edge: candidate.edge === "left" ? "left" : "right",
    preset:
      candidate.preset === "upper" || candidate.preset === "lower"
        ? candidate.preset
        : "middle",
  };
}

export function getLauncherTop(
  preset: LauncherPreset,
  viewportHeight: number,
  launcherSize: number = 44,
): number {
  const viewportMargin = 12;
  const preferredTopInset = 72;
  const composerClearance = 104;
  const absoluteMaximum = Math.max(
    viewportMargin,
    viewportHeight - launcherSize - viewportMargin,
  );
  const minimum = Math.min(preferredTopInset, absoluteMaximum);
  const maximum = Math.max(
    minimum,
    Math.min(
      absoluteMaximum,
      viewportHeight - launcherSize - composerClearance,
    ),
  );

  if (preset === "upper") return minimum;
  if (preset === "lower") return maximum;
  return Math.round(minimum + (maximum - minimum) / 2);
}

export function resolveLauncherEdge(
  pointerX: number,
  viewportWidth: number,
): LauncherEdge {
  return pointerX < viewportWidth / 2 ? "left" : "right";
}

export function resolveLauncherPreset(
  launcherCenterY: number,
  viewportHeight: number,
): LauncherPreset {
  if (launcherCenterY < viewportHeight / 3) return "upper";
  if (launcherCenterY > (viewportHeight * 2) / 3) return "lower";
  return "middle";
}
