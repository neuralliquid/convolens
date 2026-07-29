# ConvoLens extension capture Phase 7 handoff — 2026-07-28

## Outcome

Phase 7 enables explicitly confirmed automatic older-history loading while retaining the Phase 6 review, accumulator, and privacy boundaries.

- `Load older messages for me` is available in both the popup and WhatsApp launcher.
- Starting automatic capture requires an explicit acknowledgement that WhatsApp will scroll the selected chat.
- Operators can select the last 7 days, last 30 days, 100/250/500 messages, or a verified top-of-history marker. Every automatic run is capped at 500 retained messages.
- Date boundaries rely only on trusted date-bearing WhatsApp metadata. Date-less visible times and generated fallback timestamps cannot claim that a date boundary was reached.
- Date cutoffs use the same timezone-less wall-clock representation as WhatsApp's displayed metadata, preventing browser timezone offsets from widening or narrowing the selected range.
- A mounted window that crosses a date cutoff is trimmed after its last trusted out-of-scope message before review, so older messages from that window are not included in the selected upload scope.
- The trusted-date trim runs after queued snapshots drain for every automatic finalization, including user stop-and-review while loading or paused.
- Automatic collection scrolls upward in bounded steps, snapshots the mounted window immediately, waits for DOM/scroll-height stabilization, and reuses the Phase 6 FIFO virtualized-window accumulator.
- Stabilization accepts early stable samples only after an actual MutationObserver callback. The eager post-scroll snapshot does not advance that generation; when WhatsApp has not begun changing the history DOM, collection waits through the full three-second window before contributing to no-progress detection.
- Automatic scroll events are not separately subscribed, preventing the programmatic step and its scroll event from double-enqueuing the same fallback-only window.
- Three consecutive cycles without count, scroll-position, or scroll-height progress stop with `automatic-no-progress`; this is distinct from a verified WhatsApp top marker.
- Completion reasons distinguish user stop, date boundary, message limit, verified top, the 500-message safety cap, no progress, and repeated DOM failures.
- Pause, resume, stop-and-review, and cancel are available from both surfaces. Background control commands are serialized per operation so rapid commands are not collapsed into an unrelated in-flight response.
- Pause disconnects DOM observation and drains already-snapshotted work before it is acknowledged; resume reconnects observation before automatic scrolling continues.
- The runner rechecks pause after stabilization and draining, before any boundary or no-progress completion can be emitted.
- Cancellation, chat change, tab teardown, authentication transition, or background restart remains fail-closed and sends nothing.
- The original bottom-relative scroll position is captured before automatic movement and approximately restored only while the same chat remains selected.
- The background service worker persists only aggregate operation snapshots, including the selected boundary and progress counts. Raw messages, raw WhatsApp IDs, and alignment evidence remain in the WhatsApp tab's memory.
- When an automatic boundary deliberately trims retained items, skipped, unreadable, container, diagnostic-method, and participant counts are rebuilt from the retained readable payload rather than leaking counts from the excluded window.
- If the selected automatic boundary retains zero readable messages, the operation cancels with an explicit nothing-sent result instead of offering an empty review or creating an empty conversation.
- Final upload still requires exact-count review and explicit confirmation. Automatic completion never uploads by itself.
- Extension runtime and package metadata are synchronized at `1.0.18`.

## Repository state

- Base: `origin/main` at `f85eac938d9dac746e6c84bfad0063b2141b7cd5` (merged PR #154).
- Branch: `agent/extension-capture-phase7`.
- Worktree: `C:/tmp/convolens-extension-phase7`.
- Pull request: [#155](https://github.com/neuralliquid/convolens/pull/155).
- The primary checkout and its pre-existing untracked handoff remain untouched.

## Validation

- Chrome extension Node tests: 113 passed, 0 failed, including automatic boundary normalization, wall-clock-aligned and every-finalization boundary trimming, zero-retained-scope cancellation, trusted-date gating, consent and controls on both surfaces, serialized background controls, paused-observer suspension and post-await recheck, trimmed diagnostic rebuilding, truthful completion, anchor restoration, accumulator reuse, privacy, and all prior capture safety coverage.
- Chrome extension TypeScript: passed.
- Prettier and `git diff --check`: passed.
- Repository Turbo build: 8 of 8 packages passed.
- Production extension build and package: passed.
- Packaged manifest: version `1.0.18`; permissions remain `storage`, `activeTab`, `scripting`, and `notifications`.
- Packaged ZIP SHA-256: `C796ED87BEC3546947DC62385EEA5852C33D6C6960F1DA366EFA8EB68916E2E6`.
- No visual or authentic WhatsApp acceptance is claimed.

## Boundaries still open

- No extension, API, web, database, or Azure deployment is included.
- No authentic WhatsApp automatic-scroll, connected-send, popup-close, navigation, persistence, deduplication, restart, isolation, deletion, scroll-anchor, or console-attribution evidence is claimed.
- A verified top is reported only when a conservative WhatsApp marker is visible at scroll position zero; no-progress is not promoted to top-of-history proof.
- Approximate anchor restoration cannot guarantee WhatsApp retained identical virtualization geometry.
- No durable offline raw-message queue is introduced.

## Continuation

After Phase 7 is reviewed and merged, begin Phase 8 from current `origin/main` and keep authentic WhatsApp acceptance operator-held.
