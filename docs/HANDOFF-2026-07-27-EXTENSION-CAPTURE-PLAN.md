# ConvoLens extension capture plan handoff — 2026-07-27

## Outcome

A repository-backed phased plan now covers the full extension discussion:

- truthful loaded-message capture;
- the popup/in-page progress mismatch;
- one shared operation state;
- compact draggable launcher placement;
- pre-send preview;
- sender name-plus-phone preservation;
- neutral image/video/audio/document/sticker markers without attachment download;
- guided `Capture as I scroll`;
- automatic older-history loading;
- safe retry, legacy raw-queue migration, export, and result navigation;
- carefully labelled `Soon` functions;
- console-source attribution for Agent Desktop, promise, preload, and message-channel signals;
- authentic long-chat production acceptance.

Canonical plan:

- `docs/EXTENSION-CAPTURE-EXPERIENCE-PLAN.md`

## Repository state at plan creation

- Repository: `neuralliquid/convolens`
- Base branch: `main`
- Base commit: `2f8ab1a5895b92ed999934f33e52ac8e88324f9c`
- Plan branch: `agent/extension-capture-plan`
- Plan PR: [#146](https://github.com/neuralliquid/convolens/pull/146) (draft)
- The primary checkout's untracked `docs/HANDOFF-2026-07-24-EXTENSION-RUNTIME.md` was left untouched.

## Confirmed findings

1. The current extractor captures only messages rendered in WhatsApp's virtualized DOM. History scrolling is not implemented.
2. The popup extraction path updates the in-page progress bar but performs upload outside the in-page operation, so the in-page reset path does not run.
3. For 16 rendered messages, the final periodic extraction update is approximately 41%, matching the observed stuck bar.
4. The `Agent Desktop` strings supplied by the operator do not occur in this repository and must be attributed to their owning extension ID.
5. Generic `content.js`, `dashboard:1`, promise rejection, preload, and closed-channel messages are not sufficient attribution by themselves.
6. ConvoLens still requires its own messaging audit because its listeners use asynchronous response channels.
7. The comparison screenshots show that sender sources are complementary: ConvoLens can retain a phone while dropping the visible name because the extractor chooses one sender source by precedence.
8. Media-only messages need sender-preservation fixtures, and video detection must take precedence over generic image-thumbnail evidence.
9. Review on PR #146 identified that upgrading a stored sender from phone-only to `Name · phone` changes the existing sender-inclusive content hash and can create a duplicate intake unless compatibility is designed explicitly.
10. Re-review identified that semantic-message compatibility must also match a stable source-conversation identity; otherwise two distinct chats with identical messages can be collapsed incorrectly.
11. Re-review identified that the current `pendingUploads` queue persists complete payloads in `chrome.storage.local`, contradicting a memory-only raw-content target unless queue migration/removal is a prerequisite.
12. Follow-up review requires Phase 1 to disable update/alarm/online/login automatic retry triggers and ship legacy migration immediately, rather than leaving migration for the later operations PR.
13. `Capture as I scroll` must remain disabled and marked `Soon` until its collector ships.
14. Guided overlap merging must preserve same-sender, same-text, same-minute occurrences; generated IDs and global semantic-set deduplication are not acceptable.

## Immediate next implementation slice

Start with the plan's Phase 0 and Phase 1 as separate reviewable changes:

1. Capture the console profile matrix and attribute each supplied signal.
2. Inventory ConvoLens message listeners and senders.
3. Add a fixture representing 16 rendered messages from a longer virtualized chat.
4. Make popup extraction UI-silent in the page.
5. Guarantee progress reset for every in-page outcome.
6. Rename the action to `Send Loaded Messages` and make exclusions explicit.
7. Catch and classify expected message-channel teardown.

Then implement the sender/media fidelity slice before the shared operation-state and launcher work:

1. Collect metadata sender, visible sender, and phone evidence independently.
2. Render `Name · phone`, name-only, phone-only, or `Unidentified participant N` deterministically.
3. Preserve the message participant reference through persistence and read projection.
4. Keep the v1 hash valid while introducing a versioned exact v2 hash and an owner-scoped semantic compatibility fingerprint that excludes mutable sender labels and generated source IDs.
5. Require matching owner, platform, and stable source-conversation identity before accepting a compatibility match; legacy intakes without that scope require explicit reconciliation.
6. Prove a scoped phone-only intake and later `Name · phone` recapture resolve to the original intake, while two distinct chats with identical messages remain distinct.
7. Detect video before image when both indicators exist.
8. Render neutral `Image`, `Video`, `Audio`, `Document`, `Sticker`, or `Media` badges.
9. Show captions separately and do not download attachments.

Before claiming raw capture content is memory-only:

1. Stop adding new full payloads to `chrome.storage.local`.
2. Represent network/rate failures as retry-required, with in-memory retry while the tab remains alive.
3. Disable every automatic `retryPendingUploads()` trigger in the Phase 1 hotfix, including update, periodic alarm, online, and login/authentication paths.
4. Add a one-time authenticated migration UI for existing `pendingUploads`: user-confirmed retry or deletion, followed by removal from local storage.
5. Require recapture/review after tab loss rather than silently persisting a new raw queue.
6. Keep any future durable offline queue behind a separate threat model, opt-in, encryption, retention, deletion, and operator-acceptance decision.

Before enabling guided capture:

1. Keep `Capture as I scroll` disabled and marked `Soon` in the preview-only release.
2. Prefer stable WhatsApp message-scoped IDs for window overlap.
3. When stable IDs are absent, merge ordered windows with occurrence-aware suffix/prefix alignment rather than a semantic `Set`.
4. Preserve two legitimate same-sender, same-text, same-minute messages.
5. Surface unresolved overlap ambiguity for review instead of silently dropping occurrences.

Do not start automatic scrolling in the hotfix PR.

## Required evidence for console signals

For every error or warning, record:

- full source URL and extension ID when present;
- selected DevTools execution context;
- expanded stack or promise rejection;
- triggering user action;
- normal-profile result;
- Agent-Desktop-disabled result;
- ConvoLens-only clean-profile result;
- no-extension dashboard result where relevant;
- owner, severity, and disposition.

Redact tokens, cookies, message/contact data, and runtime/session values.

## Guardrails

- Do not treat Agent Desktop logs as ConvoLens failures.
- Do not call 16 rendered messages the complete chat.
- Do not upload during preview or scrolled collection.
- Do not scrape the broader WhatsApp contact surface.
- Do not expose raw message or identity evidence in logs.
- Do not discard a name because a phone was found in another sender source.
- Do not silently link People Directory identities from captured labels.
- Do not let sender-label enrichment create a second intake for the same ordered semantic message stream.
- Do not match compatibility candidates across different or unknown source-conversation identities.
- Do not silently collapse unscoped or ambiguous hash-compatibility candidates.
- Do not claim memory-only raw capture while `pendingUploads` still contains full payloads.
- Do not silently retry or delete legacy queued payloads during migration.
- Do not leave an automatic legacy retry trigger active while migration requires user confirmation.
- Do not enable a capture mode before its implementation phase ships.
- Do not deduplicate virtualized windows with generated IDs or a global semantic-message set.
- Do not imply that a media badge represents a retained attachment.
- Do not show more than two secondary `Soon` capabilities.
- Do not claim authentic acceptance until the authorized long-chat, persistence, deduplication, restart, isolation, and deletion sequence passes.

## Validation for this plan-only change

- Confirm Markdown formatting and repository links.
- Run `git diff --check`.
- Confirm the diff contains documentation only.
- Confirm the primary checkout remains unchanged.

## Copy-paste continuation

```text
Continue ConvoLens extension work from docs/EXTENSION-CAPTURE-EXPERIENCE-PLAN.md and docs/HANDOFF-2026-07-27-EXTENSION-CAPTURE-PLAN.md. Recheck live PR #146, current origin/main, checks, reviews, and worktree state. Preserve unrelated work. Begin with Phase 0 console and local-storage attribution; do not assume generic content.js/dashboard errors belong to ConvoLens, and inventory the complete-payload `pendingUploads` path. Then implement Phase 1 as a narrow PR: truthful loaded-message wording, popup extraction that does not mutate page progress, terminal progress reset, safe messaging-channel handling, no new raw local queue entries, disable update/alarm/online/login automatic legacy retries, ship a user-confirmed legacy queue migration, and add focused 16-rendered-message regression coverage. Follow with the sender/media fidelity slice: collect visible name and phone independently, preserve participant references, establish stable source-conversation identity, and add scoped versioned exact/compatibility hashes so label enrichment cannot duplicate a scoped intake or collapse two distinct chats. Legacy intakes without stable conversation identity require explicit reconciliation. Detect video before image and render neutral media badges without downloading attachments. Keep guided capture disabled/`Soon` until its phase ships; its collector must prefer stable message IDs and otherwise use occurrence-aware ordered-window alignment that preserves same-sender, same-text, same-minute messages. Do not implement automatic scrolling in the hotfix. Keep production acceptance operator-held until the full authorized sequence passes.
```
