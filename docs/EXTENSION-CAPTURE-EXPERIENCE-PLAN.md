# ConvoLens WhatsApp capture experience plan

**Status:** Proposed implementation plan

**Date:** 2026-07-27

**Scope:** Chrome extension capture truth, progress/state consistency, launcher UX, guided and automatic scrolled capture, console diagnostics, operational actions, and production acceptance

## 1. Outcome and product decisions

ConvoLens will offer three explicit WhatsApp capture modes:

1. **Loaded messages** captures only the messages WhatsApp currently renders.
2. **Capture as I scroll** accumulates virtualized message windows while the user scrolls.
3. **Load older messages for me** scrolls the conversation under explicit user control until a chosen boundary or a safe stop condition.

The extension must never describe the currently rendered messages as the complete chat unless it has positively verified the top of the conversation. Nothing is uploaded until the user reviews the capture scope and confirms the send.

The current permanent pill will become a compact, movable launcher. Its expanded panel will provide capture scope, preview, operation status, queue/retry actions, and at most two clearly secondary `Soon` capabilities.

## 2. Confirmed current behaviour

### 2.1 Only rendered messages are captured

WhatsApp Web virtualizes long conversations. The current extractor finds message containers in the active conversation DOM and does not load older history. The existing history-scroll call in `apps/chrome-extension/src/content.ts` is commented out, and there is no implemented history collector behind it.

Therefore a long chat can contain hundreds of messages while only 16 are currently rendered and sent. The API is correctly acknowledging the 16-message payload; the extension copy is wrong when it implies that this represents the complete current chat.

### 2.2 Popup extraction leaves the page progress bar partially filled

The popup and in-page button currently split operation ownership:

1. The popup asks the WhatsApp content script for `GET_CURRENT_CHAT`.
2. `extractCurrentChat()` updates the in-page progress UI while iterating rendered messages.
3. The popup receives the extracted data and independently asks the background worker to send it.
4. The in-page operation never reaches its own upload-completion and progress-reset path.

For 16 rendered messages, the last periodic progress update occurs at message 10:

```text
10 + (10 / 16 * 50) = 41.25%
```

That explains the approximately half-filled bar observed after a successful popup send.

### 2.3 Overlay ordering is not controlled by Chrome

The right-edge controls visible inside WhatsApp are independent page overlays injected by different extensions. Chrome lets users order pinned browser-toolbar icons, but it does not provide an ordering or collision-negotiation API for page overlays. ConvoLens must provide its own compact placement, drag, snap, and persistence behaviour.

### 2.4 Sender and media fidelity is incomplete

The supplied WhatsApp-versus-ConvoLens screenshots expose two additional capture defects:

- WhatsApp can visibly provide both a sender name and phone number, while ConvoLens stores only the phone number.
- A media-only message can arrive as `Unidentified participant N` even when WhatsApp visibly associates it with a sender.
- Video thumbnails can contain image-like DOM descendants. The current media detector checks image indicators before video indicators, so a video can be mislabeled as an image.
- The dashboard renders only `message.content`; it does not use the already persisted `isMedia` and `mediaType` fields to give media a deliberate presentation.

The sender issue is caused by treating metadata, sender-element text, and the conversation header as mutually exclusive fallbacks. These sources can contain complementary evidence: one can hold the phone while another holds the display name. Core capture must collect all message-scoped evidence first, classify each value, and only then derive a display label.

For the initial experience, media will remain a non-downloadable evidence marker:

- `Image`
- `Video`
- `Audio`
- `Document`
- `Sticker`
- `Media` only when the type cannot be determined

If a media message also has a caption, the dashboard will show the media marker and caption separately. ConvoLens will not download, proxy, or imply retention of the WhatsApp attachment in this phase.

## 3. Console signal attribution

The supplied console output must be attributed before it becomes implementation scope. Similar filenames such as `content.js` are used by many extensions and do not identify ConvoLens by themselves.

| Signal                                                             | Initial classification                               | Required evidence and action                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Loading Agent Desktop browser Extension content script`           | Foreign-extension informational log                  | The string does not exist in this repository. Expand the source link and record the full `chrome-extension://<id>/...` URL; map the ID in `chrome://extensions`. Do not change ConvoLens for this message.                                                                                                                        |
| `Frame is not Agent Desktop, not initializing helper extension`    | Foreign-extension informational log                  | Treat as the Agent Desktop extension declining to initialize in a non-target frame. Confirm the source extension ID, then exclude it from ConvoLens defect counts.                                                                                                                                                                |
| `storage.js ... Agent Desktop ... Runtime ID ...`                  | Foreign-extension informational log                  | Attribute by full source URL. Do not copy runtime/session material into issues or telemetry.                                                                                                                                                                                                                                      |
| `content.js:7370 Uncaught (in promise) Object`                     | Likely foreign, not yet proven                       | Capture the full source URL, selected DevTools execution context, expanded rejection value, and stack with pause-on-uncaught enabled. If it belongs to Agent Desktop, isolate it there. If it belongs to ConvoLens, reject with an `Error`, catch at the sender, and attach an operation ID without message content.              |
| `dashboard:1 Uncaught (in promise) Object`                         | Ambiguous                                            | Reproduce in a profile containing only ConvoLens and again with no extensions. Use the Network initiator and Sources call stack to decide whether this is the web app, ConvoLens, or another injected script. A `dashboard:1` label alone is not attribution.                                                                     |
| Unused preload warnings                                            | Probably web/framework performance warnings          | Record each real resource URL, resource type, `<link rel="preload">` initiator, `as` value, and whether/when it is consumed. Remove or correct only ConvoLens-owned preloads. Measure the relevant page before claiming performance impact.                                                                                       |
| `A listener indicated an asynchronous response ... channel closed` | Extension messaging lifecycle failure; owner unknown | Record the source extension ID and triggering action. Audit ConvoLens listeners and senders only if reproduced with ConvoLens as the sole extension. Ensure every handled async request responds, every sender catches rejection, and navigation/popup closure is represented as cancellation rather than an unhandled rejection. |

Chrome's messaging contract requires an asynchronous listener that returns literal `true` to eventually call `sendResponse`; otherwise the sender can lose the channel. ConvoLens currently uses this pattern in both the background worker and content script, so it remains an explicit audit item even though the supplied `dashboard` errors are not yet attributable to ConvoLens.

### 3.1 Attribution protocol

For each signal:

1. Clear the console and enable **Preserve log**.
2. Enable pause on uncaught exceptions and promise rejections.
3. Record the selected execution context: top page or named extension.
4. Open the source link and capture the complete source URL and stack.
5. If the URL begins `chrome-extension://`, map the ID through `chrome://extensions`.
6. Record the user action immediately preceding the signal.
7. Repeat with this profile matrix:
   - Normal operator profile with all installed extensions.
   - Agent Desktop disabled, ConvoLens enabled.
   - Clean test profile with only the packaged ConvoLens extension.
   - Clean profile with no extensions for dashboard-only warnings.
8. Classify the signal as ConvoLens extension, ConvoLens web, third-party extension, browser/framework, or unresolved.

Do not capture authentication tokens, cookies, message text, contact details, or runtime/session values in screenshots, issue bodies, logs, or Baton.

## 4. Capture and operation model

Both the popup and in-page launcher will render one shared capture operation:

```text
idle
  -> inspecting
  -> collecting
  -> ready-for-review
  -> uploading
  -> received | duplicate | queued | failed | cancelled
```

Each operation contains:

- operation ID;
- tab and chat identity;
- capture mode;
- rendered, collected, extracted, skipped, and media counts;
- oldest and newest detected timestamps;
- collection stop reason;
- upload result and resulting conversation URL;
- start and completion timestamps;
- safe error or cancellation reason.

Raw captured content remains in the WhatsApp tab's memory until confirmed or cancelled. Initial delivery must not persist raw messages in `chrome.storage.local`. Only non-sensitive operation metadata may be retained for popup reopening and support diagnostics.

### 4.1 Sender display fallback

Message-scoped sender evidence will remain structured and unmerged:

- raw metadata sender;
- raw visible sender element;
- raw display name when one is present;
- raw phone display and normalized phone when present;
- platform/contact ID when exposed on the selected message;
- extraction path and confidence for every value.

The initial user-facing label will be deterministic:

1. `Display name · phone` when both are present.
2. `Display name` when only the name is present.
3. `Phone` when only the phone is present.
4. `Unidentified participant N` only when neither exists.
5. `You` and `System` remain special actors.

This display fallback is not identity resolution. Names and phones must not be silently merged into People Directory records.

## 5. Phased implementation

### Phase 0 — Diagnostic baseline and attribution

**Purpose:** Establish which console signals belong to ConvoLens before changing runtime code.

Deliverables:

- A reproducible console-attribution checklist based on section 3.1.
- A signal ledger containing source owner, trigger, profile matrix result, severity, and disposition.
- Explicit separation of Agent Desktop logs from ConvoLens defects.
- Captured real URLs and initiators for preload warnings, with sensitive query values redacted.
- A focused audit inventory of every ConvoLens `runtime.onMessage`, `tabs.sendMessage`, and `runtime.sendMessage` path.

Exit gate:

- Every supplied console signal is attributed or marked unresolved with the exact missing evidence.
- No third-party signal is accepted as a ConvoLens defect without a ConvoLens source URL or clean-profile reproduction.
- No sensitive browser/session material is stored in the evidence.

### Phase 1 — Truthful count and progress hotfix

**Purpose:** Correct the misleading and stuck UI before adding capture modes.

Deliverables:

- Extraction accepts an optional progress reporter.
- Popup `GET_CURRENT_CHAT` extraction does not mutate the in-page launcher.
- The in-page path resets progress on success, duplicate, queued, error, empty extraction, and cancellation.
- Unknown-duration work uses an indeterminate indicator.
- `Send Current Chat` becomes `Send Loaded Messages`.
- Success becomes `<n> loaded messages received by ConvoLens`.
- Copy states that older messages not loaded by WhatsApp were excluded.
- Messaging senders catch and classify channel closure instead of producing unhandled promise rejections.

Exit gate:

- A 16-node fixture sends and persists exactly 16 messages.
- Popup initiation leaves the in-page progress UI idle after completion.
- Both surfaces show the same terminal result.
- No UI calls the loaded subset the complete chat.

### Phase 2 — Sender and media fidelity

**Purpose:** Preserve the WhatsApp evidence visible in the supplied comparison screenshots.

Deliverables:

- Parse metadata sender, visible sender element, and message-scoped phone evidence independently instead of selecting the first non-empty string.
- Prefer a non-phone display name for the name field while retaining the phone separately.
- Derive `Name · phone`, name-only, phone-only, or unidentified labels using section 4.1.
- Preserve message-to-participant references through the API and durable conversation projection.
- Add fixtures for:
  - name and phone both present;
  - phone in metadata and name in the visible sender element;
  - name in metadata and phone in a sibling/ancestor element;
  - media-only group messages;
  - missing sender metadata;
  - direct-chat, outgoing, and system actors.
- Detect video before image when both kinds of indicators occur in a thumbnail subtree.
- Prefer semantic elements and accessible metadata (`video`, audio player, document/sticker markers) before generic image thumbnails.
- Render a neutral media-type badge from persisted `isMedia` and `mediaType`.
- Show a media caption separately when present.
- Do not fetch or render the attachment itself.

Exit gate:

- A WhatsApp message showing `Greg Wright` and `+27 76 138 8725` renders both in ConvoLens.
- Name-only and phone-only messages retain their available evidence.
- Media-only messages retain the correct sender whenever WhatsApp exposes one.
- A video thumbnail with an image descendant is stored and displayed as `Video`, not `Image`.
- Image and video messages display intentional labels rather than raw lowercase placeholders.
- Existing content-hash deduplication remains deterministic.
- No raw participant or message evidence is added to logs.

### Phase 3 — Shared operation state

**Purpose:** Remove duplicated orchestration from the popup and page UI.

Deliverables:

- One capture command and operation state machine for both surfaces.
- One active operation per WhatsApp tab.
- Popup reopening displays the active or most recent operation.
- Chat navigation cancels collection safely.
- Double activation cannot create concurrent sends.
- Every handled async message receives a serialized success, failure, or cancellation response.
- Background and content-script teardown are treated as explicit lifecycle outcomes.

Exit gate:

- Start in either surface and observe the same state in the other.
- Close the popup during upload; the operation continues and remains observable.
- All operation paths terminate without an unhandled rejection or open message channel.

### Phase 4 — Compact movable launcher

**Purpose:** Prevent collisions with other page overlays and create a stable home for the workflow.

Deliverables:

- Compact 40-44px launcher instead of the permanent full-width pill.
- Vertical drag with left/right edge snapping.
- Upper, middle, and lower presets.
- Persisted position, constrained to the current viewport.
- Expanded panel that opens inward and remains on-screen.
- Ready, collecting, review-count, received, queued, and attention states.
- Keyboard, focus, reduced-motion, forced-colour, and narrow-window support.

Exit gate:

- Launcher position survives reload.
- It does not cover the WhatsApp composer when collapsed.
- The user can move it away from Agent Desktop or other extension overlays.
- Expanded content remains usable at supported window sizes.

### Phase 5 — Preview and capture-mode selection

**Purpose:** Make capture scope explicit before data leaves WhatsApp.

Deliverables:

- Chat name and currently loaded message count.
- Oldest/newest detected timestamps.
- Detected participant-label, media, skipped, and unreadable counts.
- Capture-mode choices:
  - `Loaded messages`;
  - `Capture as I scroll`;
  - `Load older messages for me` marked `Soon` until Phase 7.
- Review step showing exactly what will be uploaded.
- Explicit confirm and cancel actions.

Exit gate:

- Preview count equals payload count.
- Switching modes discards the prior unconfirmed buffer.
- Cancel sends nothing.
- Scope and exclusions remain visible through confirmation.

### Phase 6 — Guided `Capture as I scroll`

**Purpose:** Accumulate WhatsApp's virtualized message windows without taking control of the user's scroll.

Deliverables:

- User-initiated collection that observes the active conversation while the user scrolls upward.
- Incremental extraction before WhatsApp removes old DOM windows.
- Stable local fingerprints for overlap deduplication without changing the API's content-hash contract.
- Running unique count and oldest captured date.
- `Stop and review` and `Cancel` controls.
- Abort on chat change, tab teardown, DOM failure, timeout, or safety limit.
- Explicit stop reason in the review.

Exit gate:

- A 200-message virtualized fixture with 16 mounted nodes collects all 200 across guided windows.
- Window overlap creates no duplicates.
- Repeated text at different times remains distinct.
- Incoming/outgoing direction, sender evidence, timestamps, and media markers survive collection.
- Chat switching cannot mix two conversations.

### Phase 7 — Automatic `Load older messages for me`

**Purpose:** Add opt-in automatic history loading after guided collection is proven.

Deliverables:

- Confirmation that WhatsApp will scroll while collection runs.
- Boundaries for last 7 days, last 30 days, message limit, or verified top.
- Pause, resume, stop-and-review, and cancel.
- DOM stabilization waits and no-progress detection.
- Approximate restoration of the user's original scroll anchor.
- Initial 500-message safety cap until proxy, API, database, and dashboard performance are verified.
- Truthful completion reasons such as top reached, date boundary reached, cap reached, no progress, or cancelled.

Exit gate:

- Guided and automatic collection produce the same ordered result over the same range.
- Cancellation stops automatic scrolling promptly.
- `Complete conversation` appears only after verified top-of-history detection.
- Large-capture validation shows the exact confirmed count in the API and dashboard.

### Phase 8 — Operational actions and roadmap preview

**Purpose:** Complete the practical capture loop without overloading the launcher.

Live actions, in order:

1. Open the received ConvoLens conversation.
2. Display new-versus-duplicate result.
3. Show queued upload count and retry safely.
4. Display last capture count and time.
5. Export the reviewed capture locally.
6. Remember the preferred capture mode.
7. Add a browser-toolbar badge for queue or attention state.

Initial planned actions:

- `Select individual messages` — `Soon`.
- `Match participants` — `Soon`.

Later planned actions, only after contracts exist:

- `Draft follow-up` — `Soon`.
- `Create ticket candidate` — `Soon`.

Rules:

- Show no more than two `Soon` actions at once.
- Keep them inside the expanded panel, not on the launcher.
- Clearly describe them as unavailable.
- Identity matching remains conservative and user-confirmed.
- Ticket and follow-up output remains draft-only and human-reviewed.
- Do not advertise background automatic synchronization.

Exit gate:

- Retry cannot create unexpected duplicate conversations.
- Queue state survives service-worker restart without persisting raw capture content unnecessarily.
- Result links open the exact persisted conversation.
- Local export matches the reviewed payload.

### Phase 9 — Hardening, release, and authentic acceptance

Automated matrix:

- popup and launcher initiation;
- all operation terminal states;
- loaded-only, guided, and automatic collection;
- virtual-window overlap and repeated messages;
- direct and group conversations;
- sender direction and identity evidence;
- localized timestamps;
- image/video/audio/document/sticker classification, captions, and unreadable-message accounting;
- name-plus-phone, name-only, phone-only, and unidentified sender projection;
- cancellation, navigation, popup closure, tab reload, and service-worker restart;
- offline queue and retry;
- API new-versus-duplicate response;
- messaging-channel teardown without unhandled promise rejection;
- preload inventory and web performance baseline;
- extension tests, typecheck, build, package, version alignment, and ZIP inspection.

Operator acceptance on an authorized long conversation:

1. Record the initially loaded count.
2. Send loaded-only mode and verify the exact persisted count.
3. Run guided scrolled capture and record the increased count and range.
4. Run automatic capture over the same boundary and compare results.
5. Review and confirm the payload before sending.
6. Verify API acknowledgement and the resulting dashboard conversation.
7. Verify representative old/new messages and the exact persisted count.
8. Re-send the identical capture and verify deterministic deduplication.
9. Restart the API through the approved operation and verify persistence.
10. Verify cross-user isolation and authenticated deletion.
11. Repeat the console-attribution profile matrix and close only ConvoLens-owned errors.
12. Record screenshots, safe IDs, timestamps, loaded extension version, build identity, and acceptance owner.

Packaging, CI, health checks, synthetic fixtures, or a popup success message do not independently satisfy this operator gate.

## 6. Planned implementation PR sequence

This document is the plan PR. Implementation should remain split into reviewable follow-ups:

1. **PR A:** console attribution ledger, messaging audit, and reproduction fixtures.
2. **PR B:** truthful loaded-count and progress hotfix.
3. **PR C:** sender name/phone preservation and neutral media-type rendering.
4. **PR D:** shared capture operation state.
5. **PR E:** compact draggable launcher.
6. **PR F:** preview and loaded-message mode.
7. **PR G:** guided `Capture as I scroll`.
8. **PR H:** automatic older-history loading.
9. **PR I:** queue, retry, result links, local export, and toolbar badge.
10. **PR J:** carefully labelled future-action previews.
11. **PR K:** release evidence, operator acceptance, and durable closeout.

Each implementation PR must preserve unrelated work, validate the exact changed surface, and update the durable handoff with what is implemented, what is deployed, and what remains operator-held.

## 7. Guardrails

- Never claim full-history capture without verified top-of-conversation evidence.
- Never upload while merely previewing or collecting.
- Never capture other chats or the broader contact book as a side effect.
- Never discard an available display name merely because a phone appears in higher-priority metadata.
- Never infer a person link from a display name or phone fallback.
- Never label a video as an image solely because its thumbnail contains an image element.
- Never imply that a media marker means ConvoLens downloaded or retained the attachment.
- Never log message text, raw sender/contact values, tokens, cookies, or session/runtime identifiers.
- Never attribute a third-party extension error to ConvoLens from a generic filename alone.
- Never turn `Soon` capabilities into implied live functionality.
- Never silently merge participant identities.
- Never turn a deterministic ticket candidate into automatic publishing.
- Never call packaging, deployment health, or synthetic browser execution authentic operator acceptance.

## 8. Primary code surfaces for implementation

- `apps/chrome-extension/src/content.ts`
- `apps/chrome-extension/src/content.css`
- `apps/chrome-extension/src/background.ts`
- `apps/chrome-extension/src/config.ts`
- `apps/chrome-extension/src/dom-selectors.ts`
- `apps/chrome-extension/popup/popup.js`
- `apps/chrome-extension/popup/popup.html`
- `apps/chrome-extension/tests/`
- `apps/api/src/routes/chat-export.routes.ts`
- `apps/api/src/services/conversation-intake.service.ts`
- `apps/web/src/app/dashboard/conversations/[id]/page.tsx`

## 9. Reference documentation

- Chrome extension messaging: <https://developer.chrome.com/docs/extensions/develop/concepts/messaging>
- Chrome extension debugging: <https://developer.chrome.com/docs/extensions/get-started/tutorial/debug>
- Chrome content-script execution contexts: <https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts>
- Preload warning interpretation: <https://web.dev/articles/codelab-preload-critical-assets>
