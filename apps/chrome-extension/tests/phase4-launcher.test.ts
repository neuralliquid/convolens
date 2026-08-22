/// <reference types="jest" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, screen, within } from "@testing-library/dom";
import {
  clampLauncherTop,
  getLauncherTop,
  normalizeLauncherPosition,
  resolveLauncherEdge,
  resolveLauncherPanelAnchor,
  resolveLauncherPreset,
} from "../src/launcher-position";
import { STORAGE_KEYS } from "../src/config";

// content.ts has no exports and self-invokes `init()` on import based on
// `document.readyState`; the only way to exercise its launcher behavior is
// to drive that real bootstrap (pre-seeded DOM + a mocked `chrome`) rather
// than importing individual functions.

// jsdom 20 (bundled with jest-environment-jsdom 29) ships no PointerEvent
// constructor at all, and no setPointerCapture/hasPointerCapture/
// releasePointerCapture on Element — content.ts's drag handling calls all
// of these, so polyfill just enough to dispatch and read real pointer
// events without throwing.
class PointerEventPolyfill extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
    this.pointerType = init.pointerType ?? "mouse";
  }
}
(window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill;
Element.prototype.setPointerCapture = jest.fn();
Element.prototype.releasePointerCapture = jest.fn();
Element.prototype.hasPointerCapture = jest.fn(() => false);

// content.ts's chatObserver is module-scoped: each `jest.resetModules()` +
// require() creates a fresh instance that has no reference to a prior
// instance's observer, so it never gets disconnected. Left alone, a stale
// observer from a previous test fires on the next test's
// `document.body.innerHTML = ...` and drives content.ts's WhatsApp
// chat-identity refresh against a DOM it no longer matches. Track every
// MutationObserver created during a test and disconnect it afterwards.
const liveMutationObservers: MutationObserver[] = [];
const RealMutationObserver = window.MutationObserver;
class TrackedMutationObserver extends RealMutationObserver {
  constructor(callback: MutationCallback) {
    super(callback);
    liveMutationObservers.push(this);
  }
}
window.MutationObserver = TrackedMutationObserver as unknown as typeof MutationObserver;

afterEach(() => {
  liveMutationObservers.forEach((observer) => observer.disconnect());
  liveMutationObservers.length = 0;
});

const stylesheet = readFileSync(
  path.join(__dirname, "../src/content.css"),
  "utf8",
);

interface ChromeMock {
  runtime: {
    onMessage: { addListener: jest.Mock; removeListener: jest.Mock };
    sendMessage: jest.Mock;
    openOptionsPage: jest.Mock;
    lastError: undefined;
    getManifest: jest.Mock;
  };
  storage: {
    local: { get: jest.Mock; set: jest.Mock };
  };
}

function installChromeMock(stored: Record<string, unknown> = {}): ChromeMock {
  const chromeMock: ChromeMock = {
    runtime: {
      onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
      sendMessage: jest.fn(() => Promise.resolve({})),
      openOptionsPage: jest.fn((callback?: () => void) => callback?.()),
      lastError: undefined,
      getManifest: jest.fn(() => ({ version: "0.0.0-test" })),
    },
    storage: {
      local: {
        get: jest.fn(() => Promise.resolve({ ...stored })),
        set: jest.fn(() => Promise.resolve()),
      },
    },
  };
  (global as unknown as { chrome: ChromeMock }).chrome = chromeMock;
  return chromeMock;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function renderLauncher(
  options: {
    storedPosition?: Record<string, unknown>;
    innerWidth?: number;
    innerHeight?: number;
  } = {},
) {
  window.innerWidth = options.innerWidth ?? 1200;
  window.innerHeight = options.innerHeight ?? 900;
  document.body.innerHTML = '<div data-testid="chat-list"></div>';
  const chromeMock = installChromeMock(
    options.storedPosition
      ? { [STORAGE_KEYS.launcherPosition]: options.storedPosition }
      : {},
  );

  jest.resetModules();
  require("../src/content");
  await flush();
  await flush();

  const fab = document.getElementById("convolens-fab") as HTMLElement;
  const toggle = document.getElementById(
    "ws-launcher-toggle",
  ) as HTMLButtonElement;
  const panel = document.getElementById("ws-launcher-panel") as HTMLElement;

  // jsdom performs no layout, so getBoundingClientRect() is always zero.
  // The drag math reads rect.top to seed and re-read the launcher's
  // position, so make it track the inline style real layout would produce.
  fab.getBoundingClientRect = jest.fn(() => {
    const top = parseFloat(fab.style.top) || 0;
    return {
      top,
      bottom: top + 44,
      left: 0,
      right: 44,
      width: 44,
      height: 44,
      x: 0,
      y: top,
      toJSON() {
        return {};
      },
    } as DOMRect;
  });

  return { fab, toggle, panel, chromeMock };
}

function firePointer(
  target: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  init: { pointerId: number; clientX: number; clientY: number; button?: number },
) {
  fireEvent(
    target,
    new PointerEventPolyfill(type, { bubbles: true, cancelable: true, ...init }),
  );
}

function drag(
  toggle: HTMLElement,
  points: Array<{ clientX: number; clientY: number }>,
  pointerId = 1,
) {
  firePointer(toggle, "pointerdown", { pointerId, button: 0, ...points[0] });
  for (const point of points.slice(1)) {
    firePointer(toggle, "pointermove", { pointerId, ...point });
  }
  firePointer(toggle, "pointerup", { pointerId, ...points[points.length - 1] });
}

beforeAll(() => {
  const style = document.createElement("style");
  style.textContent = stylesheet;
  document.head.appendChild(style);
});

describe("launcher position math", () => {
  test("normalizes persisted launcher placement without trusting arbitrary data", () => {
    expect(normalizeLauncherPosition(null)).toEqual({
      edge: "right",
      preset: "middle",
    });
    expect(normalizeLauncherPosition({ edge: "left", preset: "lower" })).toEqual(
      { edge: "left", preset: "lower" },
    );
    expect(
      normalizeLauncherPosition({ edge: "center", preset: "anywhere" }),
    ).toEqual({ edge: "right", preset: "middle" });
  });

  test("keeps all three presets inside the viewport and above the composer", () => {
    const upper = getLauncherTop("upper", 900);
    const middle = getLauncherTop("middle", 900);
    const lower = getLauncherTop("lower", 900);
    expect(upper).toBeLessThan(middle);
    expect(middle).toBeLessThan(lower);
    expect(lower + 44).toBeLessThanOrEqual(900 - 104);
    expect(getLauncherTop("lower", 120)).toBeGreaterThanOrEqual(12);
    expect(getLauncherTop("lower", 120) + 44).toBeLessThanOrEqual(120 - 12);
  });

  test("snaps pointer placement to an edge and vertical preset", () => {
    expect(resolveLauncherEdge(100, 1000)).toBe("left");
    expect(resolveLauncherEdge(900, 1000)).toBe("right");
    expect(resolveLauncherPreset(100, 900)).toBe("upper");
    expect(resolveLauncherPreset(450, 900)).toBe("middle");
    expect(resolveLauncherPreset(800, 900)).toBe("lower");
  });
});

describe("launcher rendering", () => {
  test("renders a compact inward-opening launcher with explicit position controls", async () => {
    const { fab, toggle, panel } = await renderLauncher();

    expect(fab.className).toContain("ws-launcher");
    expect(fab.contains(toggle)).toBe(true);
    expect(fab.contains(panel)).toBe(true);
    expect(panel.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    // The position controls live inside the collapsed panel, so they're
    // excluded from the accessibility tree until it's opened.
    fireEvent.click(toggle);
    expect(panel.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    const presetButtons = within(fab).getAllByRole("button", {
      name: /^(Top|Middle|Bottom)$/,
    });
    expect(
      presetButtons.map((button) => button.getAttribute("data-launcher-preset")),
    ).toEqual(expect.arrayContaining(["upper", "middle", "lower"]));

    const edgeButtons = within(fab).getAllByRole("button", {
      name: /^(Left|Right)$/,
    });
    expect(
      edgeButtons.map((button) => button.getAttribute("data-launcher-edge")),
    ).toEqual(expect.arrayContaining(["left", "right"]));

    fireEvent.click(toggle);
    expect(panel.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("drag affordance", () => {
  test("shows a clickable pointer, not a permanent drag hand, until a drag is confirmed", async () => {
    const { toggle } = await renderLauncher();

    expect(toggle.classList.contains("ws-dragging")).toBe(false);
    expect(getComputedStyle(toggle).cursor).toBe("pointer");

    firePointer(toggle, "pointerdown", { pointerId: 1, button: 0, clientX: 500, clientY: 500 });
    expect(toggle.classList.contains("ws-dragging")).toBe(false);
    expect(getComputedStyle(toggle).cursor).toBe("pointer");

    firePointer(toggle, "pointermove", { pointerId: 1, clientX: 500, clientY: 520 });
    expect(toggle.classList.contains("ws-dragging")).toBe(true);
    expect(getComputedStyle(toggle).cursor).toBe("grabbing");

    firePointer(toggle, "pointerup", { pointerId: 1, clientX: 500, clientY: 520 });
    expect(toggle.classList.contains("ws-dragging")).toBe(false);
    expect(getComputedStyle(toggle).cursor).toBe("pointer");
  });

  test("never carries drag-suppression state into the next pointer gesture", async () => {
    const { toggle, panel } = await renderLauncher();

    // A real drag with no trailing `click` (e.g. the pointer left the
    // element before a click could fire) leaves suppression state set.
    drag(toggle, [
      { clientX: 500, clientY: 500 },
      { clientX: 500, clientY: 540 },
    ]);
    expect(panel.hidden).toBe(true);

    // A later, wholly separate gesture (no movement, so this is just a
    // click) must still register — the new pointerdown resets the stale
    // suppression before this gesture's own click fires.
    firePointer(toggle, "pointerdown", { pointerId: 2, button: 0, clientX: 500, clientY: 540 });
    firePointer(toggle, "pointerup", { pointerId: 2, clientX: 500, clientY: 540 });
    fireEvent.click(toggle);

    expect(panel.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("free-drag placement", () => {
  test("persists free-drag placement as a clamped pixel offset instead of snapping to a preset", async () => {
    const { fab, toggle, chromeMock } = await renderLauncher({ innerHeight: 900 });
    chromeMock.storage.local.set.mockClear();

    const startTop = parseFloat(fab.style.top);
    drag(toggle, [
      { clientX: 900, clientY: 300 },
      { clientX: 900, clientY: 340 }, // +40px, past the 5px click/drag threshold
    ]);
    await flush();

    const expectedTop = clampLauncherTop(startTop + 40, 900);
    expect(parseFloat(fab.style.top)).toBe(expectedTop);
    expect(fab.classList.contains("ws-edge-right")).toBe(true);

    expect(chromeMock.storage.local.set).toHaveBeenCalledTimes(1);
    const [savedArg] = chromeMock.storage.local.set.mock.calls[0];
    const saved = savedArg[STORAGE_KEYS.launcherPosition];
    expect(typeof saved.top).toBe("number");
    expect(saved.top).toBe(expectedTop);
    expect(saved.edge).toBe("right");
  });

  test("preset buttons still work and clear any custom drag position", async () => {
    const { fab, toggle, chromeMock } = await renderLauncher({
      innerHeight: 900,
      storedPosition: { edge: "right", preset: "middle", top: 400 },
    });
    chromeMock.storage.local.set.mockClear();

    fireEvent.click(toggle); // open the panel to reach the position controls
    const topButton = within(fab).getByRole("button", { name: "Top" });
    fireEvent.click(topButton);
    await flush();

    const expectedTop = getLauncherTop("upper", 900);
    expect(parseFloat(fab.style.top)).toBe(expectedTop);
    expect(topButton.getAttribute("aria-pressed")).toBe("true");

    expect(chromeMock.storage.local.set).toHaveBeenCalledTimes(1);
    const [savedArg] = chromeMock.storage.local.set.mock.calls[0];
    const saved = savedArg[STORAGE_KEYS.launcherPosition];
    expect(saved.preset).toBe("upper");
    expect(saved.top).toBeUndefined();
  });
});

describe("settings-panel anchor tracks real position", () => {
  test("derives the panel anchor from the launcher's actual position, both dragged to the safe band's edges and at rest", async () => {
    const { fab, toggle } = await renderLauncher({ innerHeight: 900 });

    const restTop = parseFloat(fab.style.top);
    expect(fab.dataset.preset).toBe(resolveLauncherPanelAnchor(restTop, 900));
    expect(fab.dataset.preset).toBe("middle");

    // Drag far past the top of the safe band; clamping guarantees it lands
    // on the minimum regardless of exactly how far this pushes.
    drag(toggle, [
      { clientX: 900, clientY: 500 },
      { clientX: 900, clientY: -5000 },
    ]);
    const topDragTop = parseFloat(fab.style.top);
    expect(fab.dataset.preset).toBe(resolveLauncherPanelAnchor(topDragTop, 900));
    expect(fab.dataset.preset).toBe("upper");

    // Drag far past the bottom of the safe band.
    drag(toggle, [
      { clientX: 900, clientY: topDragTop },
      { clientX: 900, clientY: topDragTop + 5000 },
    ]);
    const bottomDragTop = parseFloat(fab.style.top);
    expect(fab.dataset.preset).toBe(
      resolveLauncherPanelAnchor(bottomDragTop, 900),
    );
    expect(fab.dataset.preset).toBe("lower");
  });
});

describe("duplicate injection guard", () => {
  test("keeps exactly one launcher in the DOM when injection runs concurrently", async () => {
    window.innerWidth = 1200;
    window.innerHeight = 900;
    document.body.innerHTML = '<div data-testid="chat-list"></div>';
    installChromeMock();

    // Two independent module instances sharing the same live document,
    // reproducing two racing content-script injections (e.g. the popup's
    // self-heal re-injection landing while the original is still settling).
    jest.resetModules();
    require("../src/content");
    jest.resetModules();
    require("../src/content");

    await flush();
    await flush();
    await flush();

    expect(document.querySelectorAll("#convolens-fab")).toHaveLength(1);
  });
});
