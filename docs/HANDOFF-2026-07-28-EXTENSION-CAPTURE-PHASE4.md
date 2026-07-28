# ConvoLens extension capture Phase 4 handoff — 2026-07-28

## Outcome

Phase 4 replaces the permanent full-width WhatsApp pill with the compact movable launcher from the phased extension plan.

- The collapsed launcher is 44px square and remains above the composer at its lower preset.
- Pointer dragging snaps to the left or right edge and to upper, middle, or lower vertical presets. The same presets and edge move are available as explicit keyboard-accessible controls.
- Only the normalized non-sensitive `{ edge, preset }` placement is persisted in `chrome.storage.local`. Reload and viewport resize reapply a constrained preset rather than trusting arbitrary stored coordinates.
- The expanded panel is absolutely anchored inward from either edge, aligned to the selected vertical preset, width- and height-bounded to the viewport, and scrollable when needed.
- The panel renders ready, inspecting/collecting, review count, uploading, received/duplicate, retry-required, failed/cancelled, and legacy-migration attention states without changing the Phase 3 operation owner.
- The legacy attention state receives only an authenticated, background-derived count. The WhatsApp content script does not read or subscribe to raw legacy `pendingUploads` values.
- Escape, focus-visible, reduced-motion, forced-colour, dark-mode, and narrow-window behavior are included.
- The shared Phase 3 operation state machine, explicit loaded-message review, Phase 2 reconciliation truth, and memory-only new raw capture boundary remain intact.
- Extension runtime and package metadata are synchronized at `1.0.15`.

## Repository state

- Base: `origin/main` at `373e76dc3bf54ac9c116fce82550f1b6ea1c89f6` (merged PR #151).
- Branch: `agent/extension-capture-phase4`.
- Worktree: `C:/tmp/convolens-extension-phase4`.
- Pull request: to be opened.
- The primary checkout and its pre-existing untracked handoff remain untouched.

## Validation

- Chrome extension Node tests: 61 passed, 0 failed, including six focused launcher placement, inward anchoring, state, accessibility, and privacy-boundary tests.
- Chrome extension TypeScript: passed.
- Prettier and `git diff --check`: passed.
- Repository Turbo build: 8 of 8 packages passed.
- Production extension build and package: passed.
- Packaged manifest: version `1.0.15`; permissions remain `storage`, `activeTab`, `scripting`, and `notifications`.
- Packaged ZIP SHA-256: `BC0C0EAF68BD771C1917EA294FEDA2E59ED74046A6D23EB1EBBB1CC3E4F75628`.
- A local mocked WhatsApp Playwright smoke exposed an initial outward/flex-shrunk panel defect, which was replaced by explicit absolute inward anchoring and covered by focused source tests. The Playwright session wrapper became unresponsive before a post-fix screenshot could be captured, so no final visual or authentic acceptance is claimed.

## Boundaries still open

- No extension, API, web, database, or Azure deployment is included.
- No authentic WhatsApp position persistence, drag, keyboard, overlay-collision, narrow-window, connected-send, popup-close, navigation, persistence, deduplication, restart, isolation, deletion, or console-attribution evidence is claimed.
- The launcher surfaces only a safe legacy count and opens the existing export-or-confirmed-deletion settings flow. It does not upload, retry, inspect, or delete legacy entries.
- Guided `Capture as I scroll` and automatic older-history loading remain unavailable. No durable offline raw-message queue is introduced.

## Continuation

After Phase 4 is reviewed and merged, begin Phase 5 from current `origin/main`: add the explicit preview and capture-mode selection UI while preserving the shared operation state, loaded-message confirmation gate, privacy boundary, and the two disabled `Soon` modes until their implementation phases ship.
