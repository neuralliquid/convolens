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
- Pull request: [#156](https://github.com/neuralliquid/convolens/pull/156).
- The primary checkout and its pre-existing untracked handoff remain untouched.

## Validation

- Chrome extension Node tests: 137 passed, 0 failed.
- Chrome extension TypeScript: passed.
- Popup JavaScript syntax: passed.
- Prettier and `git diff --check`: passed.
- Focused API conversation-intake service tests: 29 passed, 0 failed, supporting deterministic duplicate and authenticated-user isolation behavior.
- Repository Turbo build: 8 of 8 packages passed.
- Production extension build and package: passed.
- Packaged manifest: version `1.0.19`; permissions remain `storage`, `activeTab`, `scripting`, and `notifications`.
- Packaged ZIP SHA-256: `51A0A34AB44411A039F47E9475EB0432047D3E428E83A40B0511E23B9469BF82`.
- Exact-head Codex review identified and prompted fixes for restored retry ownership, rejecting every cross-owner restored snapshot, closed-tab and post-upload terminal badge cleanup, immediate post-sign-in operational-state refresh, retaining separate aggregate preferences/results for each owner that uses the browser profile, keeping reconciliation truth tied to the result displayed for the active tab, hiding a terminal result link instead of falling back to an older aggregate conversation, refreshing every open launcher after a successful capture without overwriting a newer aggregate result, preserving the newest aggregate result inside the serialized storage mutation, recalculating the toolbar badge after Options removes the legacy queue, and broadcasting preferred-mode changes to every live launcher. Regression coverage is included; the remediated head requires a fresh exact-head review before merge.
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
