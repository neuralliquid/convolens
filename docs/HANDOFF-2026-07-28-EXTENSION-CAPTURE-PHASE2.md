# ConvoLens extension capture Phase 2 handoff — 2026-07-28

## Outcome

Phase 2 implements the remaining sender, deduplication, and media-fidelity slice from the phased extension plan.

- Sender metadata, visible names, and message-scoped phone evidence are combined independently and rendered as `Name · phone`, name-only, phone-only, or a numbered unidentified fallback.
- The extension emits a stable source-conversation identity only when a WhatsApp JID is present in scoped DOM evidence. Timestamp-generated capture IDs never enable compatibility matching.
- Structured participant evidence and per-message `senderRef` values now survive API persistence and authenticated read projection.
- Existing durable hashes remain v1. Stable new captures use an owner/platform/source-conversation-scoped v2 hash that excludes mutable labels.
- A separate ordered semantic compatibility hash excludes generated message IDs and sender presentation labels while retaining timestamp, direction, content, and media semantics.
- Exact v2 matches are checked first. Compatibility deduplication requires exactly one candidate in the same stable conversation and no conflicting stable participant evidence.
- Historical unscoped, conflicting, or multiple matches are stored separately with an explicit reconciliation warning; neither intake is silently merged or discarded.
- Compatibility normalizes legacy captionless media placeholders, compares all overlapping stable participant identifiers, and preserves reconciliation warnings on exact repeats.
- Video takes precedence over image descendants. The dashboard renders neutral `Image`, `Video`, `Audio`, `Document`, `Sticker`, or `Media` badges and keeps captions separate without fetching attachments.
- Extension runtime and package metadata are synchronized at `1.0.13`.

## Repository state

- Base: `origin/main` at `6af10c01950e6b57cdaa17da78d7a5e9f170ffca` (merged PR #149).
- Branch: `agent/extension-capture-phase2`.
- Worktree: `C:/tmp/convolens-extension-phase2`.
- Pull request: [#150](https://github.com/neuralliquid/convolens/pull/150) (draft at handoff update).
- The primary checkout and its pre-existing untracked `docs/HANDOFF-2026-07-24-EXTENSION-RUNTIME.md` remain untouched.

## Database boundary

- Migration `1753660000000-AddConversationFidelity.ts` adds stable-scope, participant-evidence, hash-version, compatibility, reconciliation, and message-sender-reference columns plus a scoped compatibility index.
- Existing rows default to hash version 1 and unstable source identity.
- Legacy compatibility hashes are derived and persisted lazily within the owning user's platform scope.
- The migration has been validated against SQLite through the migration test, but it has not been applied to any shared or production environment.

## Validation

- Chrome extension Node tests: 32 passed, 0 failed.
- Chrome extension TypeScript: passed.
- API Jest suite: 96 passed, 0 failed across 9 suites.
- Focused migration, route, and compatibility tests: 21 passed, 0 failed.
- Repository `pnpm run build`: 8 of 8 packages passed.
- Production extension build and package: passed.
- Packaged manifest: version `1.0.13`; permissions remain `storage`, `activeTab`, `scripting`, and `notifications`.
- Packaged ZIP SHA-256: `98AE1751B0FCE30FD6293D99E672B4C72F35BBA79C2475DEC518D839EB30B62D`.
- Prettier and `git diff --check`: passed for the changed surfaces.

## Boundaries still open

- No API, web, extension, database, or Azure deployment is included.
- No authentic WhatsApp connected-send, persisted `Name · phone` rendering, duplicate response, reconciliation review, restart, isolation, deletion, or media rendering has been operator-accepted.
- The extension does not download or retain WhatsApp attachments; media remains a neutral evidence marker.
- Unverified or absent WhatsApp JIDs never enable automatic compatibility matching.
- Guided scrolling and automatic older-history loading remain disabled and labelled `Soon`.

## Continuation

After Phase 2 is reviewed and merged, begin Phase 3 as a separate change from current `origin/main`: replace popup/content-local progress with one shared capture operation state keyed by tab and stable source conversation when available. Preserve the Phase 1 confirmation gate and Phase 2 reconciliation behavior. Keep all capture modes that are not yet implemented disabled and labelled `Soon`.
