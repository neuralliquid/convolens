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
- Phase 0 PR: [#147](https://github.com/neuralliquid/convolens/pull/147) (merged)
- Phase 0 head: `97f036552adfb1236701df39c495071eb3744700`
- Squash commit: `11c71231c733f7cedd8117428da802713a0d248d`
- CI: run `30316296938` completed successfully at the exact head.
- Head-specific Codex review: completed on `97f036552a` with no issues.
- Review threads: none.
- Mergeability and unchanged-head gate: verified immediately before squash merge.
- `origin/main`: verified at `11c71231c733f7cedd8117428da802713a0d248d` after merge.
- Runtime/deployment impact: none; Phase 0 changed audit documentation, a synthetic fixture, and focused regression coverage only.
- The primary checkout remains untouched at its earlier `main` commit with its existing untracked `docs/HANDOFF-2026-07-24-EXTENSION-RUNTIME.md`.
- Baton: final merge evidence is recorded on task `c3020f7e-6be8-4b83-9dca-6d6afe9df4e2` under the canonical ConvoLens project.

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

## Copy-paste continuation

```text
Continue ConvoLens extension capture work from merged PR #147 and docs/HANDOFF-2026-07-28-EXTENSION-CAPTURE-PHASE0.md. Recheck current origin/main, open PRs, checks, reviews, Baton task c3020f7e-6be8-4b83-9dca-6d6afe9df4e2, and worktree state. Preserve the primary checkout's existing untracked docs/HANDOFF-2026-07-24-EXTENSION-RUNTIME.md and use an isolated worktree from current origin/main. Implement Phase 1 as a narrow runtime PR: require a minimal loaded-message summary and explicit confirmation before either current surface uploads; make popup extraction page-UI-silent; reset in-page progress for every terminal outcome; use truthful loaded-message wording and exclusions; normalize message/channel teardown without unhandled rejections; stop writing new raw payloads to pendingUploads; remove update, alarm, online, and login automatic retries; and replace unowned legacy retry with safe summary plus export or confirmed deletion only. Never transmit an unowned legacy entry under the current account. Keep guided and automatic capture disabled and labelled Soon. Reuse the 16-of-200 fixture and preserve both same-sender, same-text, same-minute occurrences. Do not deploy an upload-capable intermediate build without confirmation. Keep generic browser-console attribution and authentic WhatsApp acceptance operator-held until their explicit evidence gates pass.
```
