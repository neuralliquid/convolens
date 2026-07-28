# Extension capture Phase 0 audit

**Status:** Repository baseline complete; operator browser evidence pending

**Date:** 2026-07-28

**Scope:** Console-source attribution, Chrome messaging inventory, legacy raw-queue inventory, and the loaded-window reproduction fixture

## 1. Evidence boundary

This audit separates facts visible in the repository from evidence that still has to be captured in Chrome. Generic filenames such as `content.js` and page locations such as `dashboard:1` do not identify an owning extension or application.

No supplied console signal is accepted as a ConvoLens defect unless its full source URL identifies ConvoLens or it reproduces in the appropriate clean-profile run. Operator evidence must exclude tokens, cookies, message text, contact details, and session/runtime values.

## 2. Console signal ledger

`Pending` means that the repository establishes the next diagnostic step but cannot supply the required browser evidence.

| Signal                                                             | Repository finding                                                                                                                                                                                              | Current owner                                                  | Severity                   | Missing evidence and disposition                                                                                                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Loading Agent Desktop browser Extension content script`           | The string does not occur in this repository.                                                                                                                                                                   | Probable Agent Desktop extension; browser confirmation pending | Informational              | Record the full `chrome-extension://<id>/...` source URL and map the ID in `chrome://extensions`. Exclude from ConvoLens defects if the ID is not ConvoLens.             |
| `Frame is not Agent Desktop, not initializing helper extension`    | The string does not occur in this repository and describes a non-target frame.                                                                                                                                  | Probable Agent Desktop extension; browser confirmation pending | Informational              | Record source URL and extension ID. No ConvoLens change unless a ConvoLens-only profile reproduces an independently attributable failure.                                |
| `storage.js ... Agent Desktop ... Runtime ID ...`                  | The named source and product are absent from this repository.                                                                                                                                                   | Probable Agent Desktop extension; browser confirmation pending | Informational              | Record only the source extension ID. Do not copy the runtime/session value into evidence.                                                                                |
| `content.js:7370 Uncaught (in promise) Object`                     | Both ConvoLens and other extensions can bundle a file named `content.js`; the filename is not attribution.                                                                                                      | Unresolved                                                     | Pending triage             | Capture the full source URL, selected execution context, expanded rejection, stack, and trigger. Repeat with Agent Desktop disabled and with only ConvoLens enabled.     |
| `dashboard:1 Uncaught (in promise) Object`                         | A page label does not identify the rejecting promise. Several ConvoLens popup/options senders also lack complete channel-teardown handling; this is an audit finding, not proof that they produced this signal. | Unresolved                                                     | Pending triage             | Capture the Network initiator and paused rejection stack. Repeat with only ConvoLens enabled and with no extensions.                                                     |
| Unused preload warnings                                            | No real resource URL or initiator was supplied.                                                                                                                                                                 | Unresolved, likely page/framework                              | Pending performance triage | Record the redacted resource URL, `as` value, initiating markup, resource type, and consumption timing in a no-extension run. Change only a ConvoLens-owned preload.     |
| `A listener indicated an asynchronous response ... channel closed` | ConvoLens has asynchronous message listeners and therefore needs hardening, but the generic browser text does not establish ownership.                                                                          | Unresolved                                                     | Pending triage             | Record the source extension ID and trigger. Reproduce with only ConvoLens enabled. Treat popup/tab/service-worker teardown as cancellation when ConvoLens owns the path. |

### Operator profile matrix

Run each supplied signal through this matrix and attach only redacted evidence:

| Run                          | Agent Desktop | ConvoLens | Other extensions    | Required result                                        |
| ---------------------------- | ------------- | --------- | ------------------- | ------------------------------------------------------ |
| Normal operator profile      | Enabled       | Enabled   | Enabled             | Full source URL, execution context, stack, and trigger |
| Attribution isolation        | Disabled      | Enabled   | Otherwise unchanged | Whether the signal remains                             |
| ConvoLens-only clean profile | Disabled      | Enabled   | Disabled            | Whether ConvoLens owns a reproducible signal           |
| Dashboard baseline           | Disabled      | Disabled  | Disabled            | Whether page/preload signals remain without extensions |

## 3. Chrome messaging inventory

Only the TypeScript entries are production build inputs. `scripts/build-extension.mjs` bundles `src/content.ts` and `src/background.ts`; the legacy `src/content.js` and `src/background.js` files are not packaged runtime entries.

### Receivers

| Receiver                                    | Actions                                                                                                 | Response contract                                                                           | Phase 1 disposition                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/background.ts` global runtime listener | `SEND_CHAT_DATA`, `OPEN_DASHBOARD`, auth, settings, legacy retry/clear, and unsupported content actions | Always returns literal `true`; resolves or catches `handleMessage` and calls `sendResponse` | Normalize non-`Error` rejections and represent sender/channel teardown explicitly. Remove unrestricted legacy retry from the normal message surface. |
| `src/content.ts` `handleMessage`            | `GET_CURRENT_CHAT`                                                                                      | Returns literal `true`; extraction resolves or catches and responds                         | Make popup extraction page-UI-silent and normalize errors. A closed popup is cancellation, not an unhandled failure.                                 |
| `src/content.ts` `handleMessage`            | `CHECK_STATUS`, `SET_AUTH_TOKEN`, unknown action                                                        | Responds synchronously and returns `false`                                                  | Keep synchronous; classify a disappeared tab/frame at the sender.                                                                                    |

### Senders

| Sender                                            | Actions                                          | Current handling                                                              | Gap or confirmed behavior                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `popup/popup.js` `sendToWhatsApp`                 | `CHECK_STATUS`, `GET_CURRENT_CHAT`               | Catches a missing receiver, injects the packaged content runtime, and retries | The retry can still fail because the tab navigated or closed; classify that lifecycle outcome instead of leaking a rejected promise.                  |
| `popup/popup.js` initialization/auth handlers     | `GET_AUTH_STATUS`, `SYNC_MYSTIRA_AUTH`, `LOGOUT` | Several sends are awaited without an enclosing teardown-safe boundary         | Popup/service-worker closure can become an unhandled rejection. Add one safe runtime-send wrapper.                                                    |
| `popup/popup.js` capture handler                  | `SEND_CHAT_DATA`                                 | Awaited inside the capture handler's `try` block                              | Error presentation exists, but the operation needs a stable cancellation/retry-required classification.                                               |
| `src/content.ts` in-page capture                  | `SEND_CHAT_DATA`                                 | Awaited inside `handleExtractClick`                                           | The UI has terminal-reset gaps and still treats queued payloads as success-adjacent information. Phase 1 owns the correction.                         |
| `src/content.ts` result action                    | `OPEN_DASHBOARD`                                 | Fire-and-forget without a rejection handler                                   | Can produce an unhandled rejection if the service worker or channel disappears. Await or intentionally catch and classify it.                         |
| `src/background.ts` auth notification             | `SET_AUTH_TOKEN` to every WhatsApp tab           | Each tab send catches and ignores rejection                                   | Expected missing-tab/frame failures are contained, but no lifecycle result is exposed. This is acceptable for best-effort notification if documented. |
| `options/options.js` initialization/settings/auth | Auth and settings actions                        | Multiple awaited sends have no shared channel-error boundary                  | Add teardown-safe handling or remove obsolete options flows when the migration surface is implemented.                                                |
| `options/options.js` legacy queue action          | `RETRY_PENDING_UPLOADS`                          | User click is caught locally                                                  | There is no queue-specific confirmation, and original-account ownership is absent, so retry is unsafe for legacy entries.                             |

## 4. Legacy `pendingUploads` inventory

### Persisted raw fields

`PendingUpload` stores:

- `data`: the complete capture payload, including chat name, chat ID, extracted timestamp, message count, and every message's text, sender, timestamp, direction, and media metadata;
- `queuedAt`;
- `attempts`.

It stores no original user/account ID, token subject, workspace ID, payload version, consent record, expiry, or encryption metadata. The separate current `user` storage entry cannot prove who owned a legacy queued payload when a Chrome profile is shared or a different user signs in later.

### Writers and triggers

| Path                                  | Trigger                                            | Current effect                                        | Required Phase 1 change                                                                            |
| ------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `sendChatData` rate-limit branch      | Persistent extension rate limit rejects a new send | Writes the full payload to `chrome.storage.local`     | Return `retry-required`; retain reviewed raw data only in tab memory.                              |
| `sendChatData` network/timeout branch | Fetch exhausts its retries                         | Writes the full payload and describes automatic retry | Return `retry-required`; do not write a new durable raw entry.                                     |
| `handleLogin`                         | Legacy email/password login succeeds               | Calls `retryPendingUploads()` automatically           | Remove automatic retry.                                                                            |
| `runtime.onInstalled` update branch   | Extension updates                                  | Retries after five seconds                            | Remove automatic retry.                                                                            |
| Five-minute alarm                     | Service worker alarm fires                         | Retries automatically                                 | Remove the alarm and retry listener.                                                               |
| Service-worker `online` listener      | Browser reports network recovery                   | Retries automatically                                 | Remove automatic retry.                                                                            |
| Options retry button                  | Current user clicks retry                          | Retries every stored entry under the current token    | Replace with migration UI. Unowned legacy entries may be exported or deleted, but not transmitted. |
| Options clear-all button              | User confirms clearing all extension data          | Clears all local storage and recreates an empty queue | Keep separate from a queue-specific, clearly disclosed deletion action.                            |

### Additional queue risks

- Entries at five attempts are silently dropped during retry.
- A retry calls `sendChatData`, whose failure path can enqueue the payload again while the retry loop later overwrites the queue.
- Logout removes current authentication but leaves the raw queue in place.
- Installation initializes the key to an empty array; upgrade does not add ownership metadata retroactively.

### Migration decision

Phase 1 must pause all automatic triggers before exposing migration. Because existing entries have no trustworthy original-account binding, the migration surface must show safe counts/timestamps and offer **Export local queue** or **Delete local queue**. It must not upload an unowned legacy entry under the current account. Successfully exported entries remain until the user separately confirms deletion; deletion removes the legacy key when empty.

## 5. Loaded-window fixture

`apps/chrome-extension/src/__fixtures__/whatsapp-virtualized-16-of-200.html` represents the final 16 rendered records of a 200-message conversation. The fixture deliberately includes stable message-scoped IDs and two same-sender, same-text, same-minute occurrences so later guided-capture work cannot assume semantic uniqueness.

The Phase 0 regression test proves only the rendered-window boundary: 16 message records are present while the declared source conversation contains 200. It does not claim that current extraction can reach the other 184 messages.

## 6. Phase 1 entry criteria

Phase 1 may begin from this baseline when:

- browser-only signals remain explicitly pending until the operator supplies the profile matrix;
- the 16-of-200 fixture passes;
- all production message receivers/senders and queue triggers above are in implementation scope;
- the first upload-capable release includes a minimal preview and explicit confirmation gate;
- unfinished guided and automatic capture modes remain disabled and labelled `Soon`;
- no claim of memory-only capture is made until new raw queue writes and all automatic retry triggers are removed.
