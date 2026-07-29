# ConvoLens extension capture Phase 6 handoff — 2026-07-28

## Outcome

Phase 6 enables user-driven `Capture as I scroll` collection without programmatically controlling WhatsApp's scroll position.

- `Loaded messages` and `Capture as I scroll` are available in both the popup and WhatsApp launcher. Automatic older-history loading remains disabled and labelled `Soon · Phase 7`.
- Guided capture reads the initial mounted window, then snapshots every observed active-conversation DOM window before serially merging it while the user scrolls upward; it does not debounce away intermediate virtualized windows.
- The background service worker remains the single operation owner. It persists aggregate progress only; raw messages, raw WhatsApp message IDs, and fallback alignment evidence remain in tab memory.
- Background activation occurs only after the initial aggregate snapshot is published, preventing early observer progress from being overwritten by capture startup.
- Progress updates are bound to the originating tab, current operation ID, authentication lifecycle epoch, guided mode, and collecting state.
- Concurrent stop requests share one in-flight finalization promise, preventing timeout, safety, popup, and launcher stops from racing the retained buffer.
- Finalization first disconnects observation, then awaits the active FIFO drain so every already-snapshotted window is merged before the review summary is computed. Safety-limit and DOM-failure stops are dispatched only after the drain promise clears, avoiding a content/background stop deadlock.
- Stable WhatsApp message-scoped `data-id` values are preferred for overlap identity. Generated connector message IDs are never used for overlap deduplication.
- When stable IDs are absent, maximal ordered suffix/prefix alignment uses sender, text, timestamp/metadata, direction, and media evidence.
- Exact repeated fallback windows and single-message fallback overlaps are treated as occurrence-ambiguous. Longer fallback overlaps must also be sequence-unique; ambiguous overlaps retain all candidate occurrences, increment a review warning, and ask the user to use smaller upward scroll steps rather than silently deleting a possible message.
- Fallback alignment normalizes extraction-generated timestamps to a stable unavailable marker while preserving the payload timestamp, so repeated observation of a timestamp-less mounted message does not invent a new alignment token each time.
- The merge direction detects both older prepended windows and newly appended live-message windows.
- Running unique count, oldest detected timestamp, overlap warning, `Stop and review`, and `Cancel` are visible on both surfaces.
- Changing capture mode while an unconfirmed operation is cancelled preserves the user's newest requested selection on both popup and launcher, even when the cancelled operation snapshot renders asynchronously. Launcher mode restoration also awaits any already in-flight confirm/cancel request for the same operation before rechecking the requested radio.
- Stop reasons distinguish user stop, an enforced 2,000-message guided safety limit, ten-minute timeout, and three consecutive DOM read failures. Stable additions are capped before the payload is updated; an over-limit ambiguous window is rejected intact rather than partially dropping candidates. Chat changes and tab teardown cancel without sending.
- Final review preserves the exact-count confirmation gate and identifies the guided stop reason. Cancel discards the tab-memory buffer and sends nothing.
- A deterministic 200-message fixture collected through overlapping 16-node windows retains all messages in order, preserves two same-sender/same-text/same-minute occurrences, avoids duplicate copies when a window repeats, and covers appended live messages.
- Extension runtime and package metadata are synchronized at `1.0.17`.

## Repository state

- Base: `origin/main` at `0945495ee1a115c24fec96c4b92a87701e83e54d` (merged PR #153).
- Branch: `agent/extension-capture-phase6`.
- Worktree: `C:/tmp/convolens-extension-phase6`.
- Pull request: [#154](https://github.com/neuralliquid/convolens/pull/154).
- The primary checkout and its pre-existing untracked handoff remain untouched.

## Validation

- Chrome extension Node tests: 91 passed, 0 failed, including deterministic guided-window, repeated-occurrence, identical single- and multi-window ambiguity, immediate virtualized-window snapshot queuing, queued-window finalization draining, generated-timestamp normalization, mode-change cancellation preservation, enforced limit, retained-participant filtering, lifecycle, controls, privacy, and safety-boundary coverage.
- Chrome extension TypeScript: passed.
- Prettier and `git diff --check`: passed.
- Repository Turbo build: 8 of 8 packages passed.
- Production extension build and package: passed.
- Packaged manifest: version `1.0.17`; permissions remain `storage`, `activeTab`, `scripting`, and `notifications`.
- Packaged ZIP SHA-256: `91F74414C13BBA21BDC73666908EAB2B9ED09948325C3000B14D0A3422D24495`.
- A local Playwright popup screenshot was attempted, but the installed Playwright package had no local Chromium binary. No browser was downloaded solely for this check, and no visual acceptance is claimed.

## Boundaries still open

- No extension, API, web, database, or Azure deployment is included.
- No authentic WhatsApp guided-scroll, connected-send, popup-close, navigation, persistence, deduplication, restart, isolation, deletion, scroll-anchor, or console-attribution evidence is claimed.
- Stable raw WhatsApp message IDs are non-enumerable in-tab alignment evidence and are not added to the upload contract or persisted operation snapshot.
- Guided collection never takes control of the user's scroll. It cannot prove WhatsApp has exposed all older history.
- Automatic scrolling remains unavailable. No durable offline raw-message queue is introduced.

## Continuation

After Phase 6 is reviewed and merged, begin Phase 7 from current `origin/main`: add explicitly confirmed automatic older-history loading with date/message/top boundaries, pause/resume/stop/cancel, DOM stabilization and no-progress detection, a 500-message initial cap, approximate scroll-anchor restoration, and truthful completion reasons while reusing the Phase 6 accumulator and privacy boundary.
