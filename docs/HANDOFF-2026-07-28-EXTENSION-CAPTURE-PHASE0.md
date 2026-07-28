# ConvoLens extension capture Phase 0 handoff — 2026-07-28

## Outcome

Phase 0 now has a repository-backed baseline for:

- console-source attribution without assigning generic browser signals to ConvoLens;
- the complete production Chrome messaging receiver/sender inventory;
- the complete-payload `pendingUploads` writers, retry triggers, stored fields, and migration risks;
- a synthetic 16-mounted-of-200-message WhatsApp virtualization fixture;
- preservation of two same-sender, same-text, same-minute occurrences in that fixture;
- review corrections requiring export-or-delete for unowned legacy entries, confirmation in the first upload-capable phase, and exact v1 hash lookup before v2 compatibility.

Canonical audit:

- `docs/EXTENSION-CAPTURE-PHASE0-AUDIT.md`

## Repository state

- Repository: `neuralliquid/convolens`
- Base branch: `main`
- Base commit: `e97bd12d089e016c507041ef8f29c115f52a8c56`
- Working branch: `agent/extension-capture-phase0`
- Isolated worktree: `C:\tmp\convolens-extension-phase0`
- The primary checkout remains untouched at its earlier `main` commit with its existing untracked `docs/HANDOFF-2026-07-24-EXTENSION-RUNTIME.md`.

## Confirmed repository findings

1. The supplied Agent Desktop strings do not occur in this repository.
2. Generic `content.js`, `dashboard:1`, preload, and closed-channel messages remain unattributed without full browser source URLs and clean-profile reproduction.
3. The production content/background bundles are built from `src/content.ts` and `src/background.ts`; the parallel legacy JavaScript files are not build entries.
4. ConvoLens has two runtime receivers. Their async paths return literal `true`, but several senders still need explicit lifecycle handling.
5. Popup auth/init, options auth/settings, the popup injection retry, and the content-script `OPEN_DASHBOARD` action have channel-teardown gaps.
6. `PendingUpload.data` retains the complete raw capture in `chrome.storage.local` with no original user, workspace, or token-subject binding.
7. New entries are written on extension rate limits and network/timeouts.
8. Legacy entries retry automatically after legacy login, extension update, a five-minute alarm, and browser-online recovery.
9. The options retry action can transmit every legacy entry under the currently authenticated token even though ownership is unknown.
10. Retry can silently drop entries at five attempts and can requeue inside a loop that later overwrites the stored queue.

## Browser evidence still pending

The repository cannot complete the operator profile matrix. The following remain open until redacted browser evidence is captured:

- full source URL and extension ID for each supplied console signal;
- selected execution context and expanded rejection stack;
- normal-profile result;
- Agent-Desktop-disabled result;
- ConvoLens-only clean-profile result;
- no-extension dashboard/preload result.

These open evidence items do not block the safe Phase 1 code changes already established by the repository audit. They do block attributing the supplied generic console signals to ConvoLens.

## Validation

- Chrome extension Node test suite: 16 passed, 0 failed.
- The new fixture test proves exactly 16 mounted records out of a declared 200-message source conversation.
- The repeated-occurrence test proves both stable same-minute records remain in the fixture.
- Prettier check: passed for all changed files.
- `git diff --check`: passed.

## Immediate next implementation slice

Implement Phase 1 as PR B:

1. Add a minimal loaded-message summary and explicit confirmation before upload in both current surfaces.
2. Make popup extraction page-UI-silent and reset in-page progress for every terminal outcome.
3. Rename all current-chat actions/results to truthful loaded-message wording and state that unloaded older messages are excluded.
4. Normalize message errors and classify popup/tab/service-worker teardown without unhandled rejections.
5. Stop writing new capture payloads to `pendingUploads`; return `retry-required` and keep reviewed raw data only in tab memory.
6. Remove update, alarm, online, and login automatic legacy retries.
7. Replace unrestricted legacy retry with a safe-count/timestamp migration surface offering export or confirmed deletion only.
8. Never transmit an unowned legacy entry under the current account.
9. Keep guided and automatic capture modes disabled and labelled `Soon`.
10. Reuse the 16-of-200 fixture as the loaded-message regression baseline.

Do not deploy an upload-capable intermediate build without the confirmation gate. Do not claim the browser console signals are resolved until the operator profile matrix is complete. Production acceptance remains operator-held.
