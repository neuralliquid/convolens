# ConvoLens extension capture Phase 8 handoff — 2026-07-30

## Outcome

Phase 8 completes the practical post-capture loop while preserving the prior review, ownership, and in-tab raw-data boundaries.

- The popup and WhatsApp launcher can open the exact received dashboard conversation after a successful intake response.
- Result paths are accepted only when they match `/dashboard/conversations/{uuid}` exactly; arbitrary URLs and broader dashboard paths are rejected.
- Both surfaces distinguish a newly received conversation, a deterministic duplicate, and a separately stored conversation that requires reconciliation.
- The last successful capture count and completion time are retained as owner-scoped aggregate metadata.
- The preferred loaded, guided, or automatic capture mode is remembered for the authenticated owner.
- A reviewed payload can be exported locally from the active WhatsApp tab while it is still in `ready-for-review` or `retry-required` state and the same chat remains selected.
- Export serializes the exact reviewed payload with presentation-only JSON whitespace. It does not add the `downloads` permission or pass raw messages through the service worker.
- The browser-toolbar badge prioritizes retry-required, then legacy export/delete migration, then other capture attention. It adds no extension permission.
- A retry-required operation can restore only its non-sensitive operation snapshot after a service-worker restart. If the reviewed tab payload is unavailable, retry and export fail closed and require recapture and review.
- Legacy raw entries remain explicit export-or-confirmed-delete only; Phase 8 introduces no durable raw-message queue or automatic legacy transmission.
- The expanded popup and launcher show exactly two unavailable roadmap previews: `Select individual messages — Soon` and `Match participants — Soon`.
- Extension runtime and package metadata are synchronized at `1.0.19`.

## Repository state

- Base: `origin/main` at `5f179f6f884369b3616ffd653636ea4db59cf8d3` (merged PR #155).
- Branch: `agent/extension-capture-phase8`.
- Worktree: `C:/tmp/convolens-extension-phase8`.
- Pull request: pending publication.
- The primary checkout and its pre-existing untracked handoff remain untouched.

## Validation

- Chrome extension Node tests: 128 passed, 0 failed.
- Chrome extension TypeScript: passed.
- Popup JavaScript syntax: passed.
- Prettier and `git diff --check`: passed.
- Focused API conversation-intake service tests: 29 passed, 0 failed, supporting deterministic duplicate and authenticated-user isolation behavior.
- Repository Turbo build: 8 of 8 packages passed.
- Production extension build and package: passed.
- Packaged manifest: version `1.0.19`; permissions remain `storage`, `activeTab`, `scripting`, and `notifications`.
- Packaged ZIP SHA-256: `C0FB47800051336212DD356F98FBF0BBD805C26C74E5B0F08E2B0C4E84DFC686`.
- No visual or authentic WhatsApp acceptance is claimed.

## Boundaries still open

- No extension, API, web, database, or Azure deployment is included.
- No authentic WhatsApp connected-send, persistence, duplicate, reconciliation, popup-close, navigation, service-worker restart, cross-user isolation, deletion, or console-attribution evidence is claimed.
- A browser toolbar badge, popup acknowledgement, automated test, package, CI result, or synthetic fixture is not authentic WhatsApp acceptance.
- Retry remains possible only while the exact reviewed raw payload survives in the same WhatsApp tab. Tab loss requires recapture and review.
- Only aggregate result metadata is persisted. Raw message text, raw WhatsApp identifiers, chat names, and participant evidence are not added to extension storage by this phase.
- The two `Soon` actions are previews only and have no executable behavior.

## Continuation

After Phase 8 is reviewed and merged, create Phase 9 from current `origin/main`. Phase 9 should consolidate the automated release matrix, inspect the packaged ZIP, record exact-head CI/review evidence, and publish a durable closeout that clearly leaves the authorized long-conversation WhatsApp acceptance matrix operator-held until it is genuinely executed.
