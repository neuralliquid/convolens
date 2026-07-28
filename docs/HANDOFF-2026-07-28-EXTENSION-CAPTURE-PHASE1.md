# ConvoLens extension capture Phase 1 handoff — 2026-07-28

## Outcome

Phase 1 changes the current WhatsApp capture surfaces from immediate upload to explicit loaded-message review and confirmation.

- The popup reads the currently mounted WhatsApp messages without driving the in-page progress UI, shows the loaded count and exclusion boundary, and uploads only after **Confirm upload**.
- The in-page action is now **Review loaded messages** and uses an explicit confirmation containing the loaded count and older-message exclusion before upload.
- Guided **Capture as I scroll** and automatic **Load older messages for me** remain unavailable and labelled `Soon`.
- Every in-page terminal path resets progress.
- Popup, options, content, and background message paths normalize non-`Error` failures and contain expected popup, tab, frame, and service-worker teardown.
- Rate-limit, timeout, and network failures return `retry-required`; new raw captures are not written to `pendingUploads`.
- Login, extension update, alarm, and browser-online automatic legacy retries are removed, along with the `alarms` permission.
- Unowned legacy local captures are never transmitted under the current account. Settings shows only safe count/time metadata and offers explicit local export or confirmed deletion. Export does not delete; confirmed deletion removes the legacy storage key.

## Repository state

- Base: `origin/main` at `890be5b50dd93f83ab19eed0e0ce9a4f6633f2d8` (merged PR #148).
- Branch: `agent/extension-capture-phase1`.
- Pull request: [#149](https://github.com/neuralliquid/convolens/pull/149).
- Extension version: `1.0.12` in both manifest and package metadata.
- Runtime/deployment impact: extension-only. No API, database, web deployment, Azure change, or production acceptance is included.
- The primary checkout remains untouched at its earlier `main` commit with its existing untracked `docs/HANDOFF-2026-07-24-EXTENSION-RUNTIME.md`.

## Validation

- Chrome extension Node tests: 23 passed, 0 failed, including confirmed-capture snapshot and upstream HTTP 429 retry classification.
- TypeScript: passed.
- Repository CI-equivalent `pnpm run build`: 8 of 8 packages passed.
- Prettier: passed for changed TypeScript, JavaScript, JSON, tests, and handoff files; the legacy options HTML retains its existing repository formatting to avoid unrelated churn.
- Production extension build and package: passed.
- Packaged manifest: version `1.0.12`; permissions are `storage`, `activeTab`, `scripting`, and `notifications`; `alarms` is absent.
- Packaged ZIP SHA-256: `F9EC12D13BB00D112C8BBB48B00B5C6C1EDD9FED099EAEA8EAD348A7A8F8890C`.
- The 16-mounted-of-200 fixture and both same-sender, same-text, same-minute occurrences remain covered.

## Boundaries still open

- Do not deploy or install an upload-capable intermediate build without retaining the confirmation gate.
- Authentic WhatsApp connected-send, exact persisted loaded count, deterministic duplicate behavior, restart persistence, owner isolation, and authenticated deletion remain operator-held.
- Generic browser console signals remain unattributed until the redacted operator profile matrix identifies their source extension/page.
- Before starting the planned PR C slice, reconcile its sender/date work against merged PRs #141–#145 and implement only remaining hash-compatibility and media-rendering gaps.

## Continuation

Recheck the exact PR head, CI, reviews, mergeability, `origin/main`, Baton task `c3020f7e-6be8-4b83-9dca-6d6afe9df4e2`, and the primary checkout before merging or continuing. Keep the primary checkout's untracked handoff untouched. Do not call packaging, CI, synthetic fixtures, or browser UI smoke authentic production acceptance.
