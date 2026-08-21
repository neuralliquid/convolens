export type LauncherEdge = "left" | "right";
export type LauncherPreset = "upper" | "middle" | "lower";

export interface LauncherPosition {
  edge: LauncherEdge;
  preset: LauncherPreset;
  /** Free-drag vertical offset in pixels; overrides `preset` when present. */
  top?: number;
}

export const DEFAULT_LAUNCHER_POSITION: LauncherPosition = {
  edge: "right",
  preset: "middle",
};

export function normalizeLauncherPosition(value: unknown): LauncherPosition {
  if (!value || typeof value !== "object") return DEFAULT_LAUNCHER_POSITION;
  const candidate = value as Partial<LauncherPosition>;
  const top =
    typeof candidate.top === "number" && Number.isFinite(candidate.top)
      ? candidate.top
      : undefined;
  return {
    edge: candidate.edge === "left" ? "left" : "right",
    preset:
      candidate.preset === "upper" || candidate.preset === "lower"
        ? candidate.preset
        : "middle",
    ...(top === undefined ? {} : { top }),
  };
}

function getLauncherTopBounds(
  viewportHeight: number,
  launcherSize: number,
): { minimum: number; maximum: number } {
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
  return { minimum, maximum };
}

export function getLauncherTop(
  preset: LauncherPreset,
  viewportHeight: number,
  launcherSize: number = 44,
): number {
  const { minimum, maximum } = getLauncherTopBounds(
    viewportHeight,
    launcherSize,
  );
  if (preset === "upper") return minimum;
  if (preset === "lower") return maximum;
  return Math.round(minimum + (maximum - minimum) / 2);
}

/** Clamps a free-drag pixel offset into the same safe band `getLauncherTop` uses. */
export function clampLauncherTop(
  top: number,
  viewportHeight: number,
  launcherSize: number = 44,
): number {
  const { minimum, maximum } = getLauncherTopBounds(
    viewportHeight,
    launcherSize,
  );
  return Math.round(Math.min(maximum, Math.max(minimum, top)));
}

export type LauncherPanelAnchor = "upper" | "middle" | "lower";

// Must match `.ws-launcher-panel`'s `max-height: min(520px, calc(100vh - 120px))` in content.css.
const PANEL_MAX_HEIGHT_CAP = 520;
const PANEL_MAX_HEIGHT_VIEWPORT_INSET = 120;

/**
 * Picks which CSS panel-anchor the settings panel should render with for a
 * given launcher top position, derived from real viewport geometry rather
 * than the (possibly stale, e.g. after a free-drag) launcher preset label.
 */
export function resolveLauncherPanelAnchor(
  top: number,
  viewportHeight: number,
  launcherSize: number = 44,
): LauncherPanelAnchor {
  const panelHeight = Math.min(
    PANEL_MAX_HEIGHT_CAP,
    viewportHeight - PANEL_MAX_HEIGHT_VIEWPORT_INSET,
  );
  const centerY = top + launcherSize / 2;
  const fitsMiddle =
    centerY - panelHeight / 2 >= 0 &&
    centerY + panelHeight / 2 <= viewportHeight;
  if (fitsMiddle) return "middle";
  if (top + panelHeight <= viewportHeight) return "upper";
  if (top + launcherSize - panelHeight >= 0) return "lower";
  return top < viewportHeight / 2 ? "upper" : "lower";
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
