# ConvoLens extension capture Phase 3 handoff — 2026-07-28

## Outcome

Phase 3 implements the shared capture-operation slice from the phased extension plan.

- Popup and in-page initiation now use one `START_CAPTURE_OPERATION` command owned by the background worker. Direct popup/page raw-payload sends are rejected.
- The background worker owns one active operation per WhatsApp tab across `inspecting`, `collecting`, `ready-for-review`, `uploading`, `received`, `duplicate`, `retry-required`, `failed`, and `cancelled` states.
- Raw reviewed chat data remains only in the WhatsApp content script's memory. It is requested by the background worker only after confirmation and is discarded after receipt, failure, cancellation, tab teardown, or background restart. New raw captures are not written to `chrome.storage.local` or `chrome.storage.session`.
- `chrome.storage.session` retains only bounded operation metadata so reopening the popup can render the active or most recent operation. Chat identity is represented by an opaque, per-tab token; WhatsApp JIDs, contact labels, participants, and messages are not persisted in operation state.
- Popup closure does not own or cancel an in-flight upload. The background upload promise continues, updates the shared operation, and safely ignores a closed response channel.
- Concurrent starts reuse the current per-tab operation, and concurrent confirmations reuse one upload promise. Cancellation is refused once an upload has begun because an external request can no longer be truthfully undone.
- Each collection/upload carries the current capture-lifecycle epoch and an in-memory binding to the authenticated owner that reviewed it. Successful dashboard sync and direct-login writes are serialized; replacing one authenticated owner with another immediately invalidates the old owner's operations and reviewed payloads while new capture work is blocked. The owner is also revalidated together with the exact token immediately before the request is invoked, closing account-change races between confirmation and credential selection. Sign-out blocks new capture work, lets any already-authorized upload record its real result, then invalidates the epoch and discards every prior-account operation and reviewed tab payload before clearing authentication. Authentication expiry or a refresh to a different owner invalidates and clears all operations without waiting on the request that detected the change. No stale async continuation can republish after a transition, so a later account cannot inherit an earlier account's review.
- Closing a tab cancels only pre-upload work. Once the background has entered `uploading`, tab closure cannot falsely label the external request cancelled; the background records the actual request result.
- Content-script navigation compares the selected chat's verified JID or scoped header fallback and cancels pre-upload collection/review when the chat changes. Page unload, tab closure, missing receivers, and background restart become explicit cancellation outcomes.
- Both surfaces render the same operation updates, including duplicate and reconciliation-required outcomes. Loaded-message confirmation remains mandatory, and guided/automatic history capture remains unavailable.
- Extension runtime and package metadata are synchronized at `1.0.14`.

## Repository state

- Base: `origin/main` at `11463dc6e94206d27cbe56aa9dde2388562008e9` (merged PR #150).
- Branch: `agent/extension-capture-phase3`.
- Worktree: `C:/tmp/convolens-extension-phase3`.
- Pull request: [#151](https://github.com/neuralliquid/convolens/pull/151) (draft).
- The primary checkout and its pre-existing untracked handoff remain untouched.

## Validation

- Chrome extension Node tests: 46 passed, 0 failed, including shared-state, persistence-boundary, double-activation, navigation, teardown, serialized auth-owner replacement, exact-credential auth-owner binding, auth-transition invalidation, in-flight logout truth, terminal-render deduplication, page retry, and popup-reopen source contracts.
- Chrome extension TypeScript: passed.
- Popup JavaScript syntax and `git diff --check`: passed.
- Repository forced Turbo build with a worktree-local cache: 8 of 8 packages passed. The ordinary exact-source rerun encountered a Windows shared-cache log permission error after task replay; the isolated-cache run completed all tasks uncached.
- Production extension build and package: passed.
- Packaged manifest: version `1.0.14`; permissions remain `storage`, `activeTab`, `scripting`, and `notifications`.
- Packaged ZIP SHA-256: `5B8290258E68B51FA47A43F5D3BD20D6FB59955EE181F2A55E8ED7C997AE2719`.

## Boundaries still open

- No extension, API, web, database, or Azure deployment is included.
- No authentic WhatsApp popup/page synchronization, popup-close upload continuation, navigation cancellation, connected send, persistence, deduplication, restart, isolation, deletion, or console attribution has been operator-accepted.
- `chrome.storage.session` metadata restores observability after popup closure. A service-worker restart explicitly cancels an interrupted non-terminal operation; it does not pretend an unknown upload completed.
- Safe in-memory retry remains limited to a live tab and a `retry-required` operation. Durable offline raw-message queuing remains unavailable.
- Guided scrolling, automatic older-history loading, compact launcher work, and later operational actions remain separate phases.

## Continuation

After Phase 3 is reviewed and merged, begin Phase 4 from current `origin/main`: replace the permanent pill with the compact movable launcher while preserving this operation state machine, the explicit loaded-message review gate, Phase 2 reconciliation truth, and all privacy boundaries.
