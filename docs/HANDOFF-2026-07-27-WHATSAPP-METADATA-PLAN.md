# WhatsApp metadata capture and consented enrichment plan — 2026-07-27

## Status and boundary

PR #142 contains the immediate v1.0.8 repair: sender metadata can be read from a message ancestor, historical date/time is preserved from `data-pre-plain-text`, and visible phone evidence is captured as raw participant evidence. It is not production acceptance: an operator must reload the unpacked extension and send an authorized chat.

This plan has two intentionally separate tracks:

1. **Core capture** records evidence already exposed by the user-selected conversation. It is part of normal extension intake.
2. **Optional enrichment** may capture profile/contact/location/address-book data only after a granular explicit opt-in. It is off by default and must never be enabled implicitly by core capture, an update, or an organization setting.

Neither track may rewrite message text, raw sender labels, source IDs, or deduplication hashes. Do not scrape the wider WhatsApp UI/contact book during core capture.

## Core capture delivery plan

### 1. Stable WhatsApp message identity

- Capture a raw message `data-id` (or equivalent message-scoped source ID) when it is present.
- Keep the generated connector ID only as a fallback; record `sourceIdMethod` and confidence.
- Use the raw source ID for `sourceMessageId`, reply links, and idempotency correlation without making it a person identity.
- Preserve the raw attribute as evidence; do not log it.

**Gate:** sending the same selected conversation twice yields stable source-message references and the existing duplicate-ingest behavior remains correct.

### 2. Stable conversation identity

- Prefer a WhatsApp chat/group/contact identifier exposed on the selected conversation element.
- Keep the existing title/time-derived chat ID only as a low-confidence fallback.
- Persist `sourceConversationIdMethod`; never infer a conversation identity from its visible title alone.

**Gate:** renaming a chat does not create a new conversation when a stable source ID is available.

### 3. Raw metadata and sender evidence

- Preserve raw `data-pre-plain-text` alongside parsed sender/date/time.
- Search message element, ancestor, and descendant for metadata; retain the extraction path and confidence.
- Preserve raw display label, visible phone, handle, and platform/contact ID in separate nullable fields.
- Treat `You` and `System` as special actors; never create directory people for them.

**Gate:** group messages such as `~ Shane · +27 …` render a useful raw source identity even before linking to People Directory.

### 4. Historical timestamp and date-divider context

- Prefer complete timestamp metadata.
- Record raw timestamp text, parsed ISO timestamp, source locale/order, and timezone assumption.
- When metadata is absent, associate the nearest WhatsApp date divider with subsequent time-only messages; mark it medium/low confidence.
- Never silently assign today when historical date evidence is available.

**Gate:** a July 2026 message imported today retains its July 2026 timestamp; date-only fallback is visibly lower confidence.

### 5. Message state and relationships

- Capture reply/quoted-message source ID only when visible in the selected conversation.
- Capture forwarded marker, edited/deleted/revoked state, outgoing/self, system event, and media type.
- Preserve original text and media placeholder; do not download media, query message history, or fabricate relationships.

**Gate:** quoted, forwarded, edited, and revoked fixtures round-trip with their raw evidence and without changing existing message rendering.

### 6. Provenance, contracts, and safety

- Add a backward-compatible extension payload version for raw source ID, raw metadata, timestamp provenance, and message state.
- Validate field lengths/types server-side; dual-write only fields accepted by the current durable schema until the participant-persistence PR lands.
- Keep raw PII out of telemetry and logs. Use aggregate metrics only: metadata-found rate, date-fallback rate, and unidentified-participant rate.
- Add direct/group/localized DOM fixtures, deterministic parser tests, SQLite/PostgreSQL ingest coverage, duplicate-ingest coverage, and restart/deletion regression tests.

**Gate:** v1 remains accepted, v2/v3 payloads are schema-valid, no raw contact/message data appears in logs, and production browser acceptance proves capture, deduplication, restart persistence, and owner isolation.

## Optional enrichment: consented profile/contact/location/address-book capture

### Product and authorization model

- Add a **Privacy and enrichment** settings page. Every category starts disabled.
- Present four independent toggles: profile photo, profile/contact details, shared location, and wider address book.
- Each toggle must explain exact data, source, purpose, retention, visibility, and how to revoke/delete it. The default is `off`.
- Require a fresh confirmation for address-book access and any scope increase. No bulk enablement, pre-checked boxes, or consent inherited from normal chat intake.
- Scope consent to the authenticated ConvoLens user; organization sharing is a separate future authorization decision.

### Capture rules by category

| Category | Allowed scope after opt-in | Explicit exclusions |
| --- | --- | --- |
| Profile photo | Profile photo of a participant in a user-selected conversation, on user action | Background/profile crawl; automatic refresh |
| Profile/contact details | Fields visibly exposed for that selected participant, on user action | Hidden contact data; inferred details; wider contact list |
| Location | Location attachment intentionally included in a selected message, on user action | Live location tracking; background polling; deriving location from text |
| Wider address book | A user-initiated, previewed import with selectable records | Silent collection; auto-linking/merging; contacts not previewed by the user |

### Data handling and retention

- Store enrichment separately from raw conversation evidence and People Directory identity links.
- Encrypt sensitive values at rest; use least-privilege owner-scoped APIs; no enrichment in telemetry, analytics, or error logs.
- Profile photos require content-type/size limits, malware scanning, private object storage, signed owner-only reads, and a placeholder on failure.
- Location requires precise-vs-approximate labeling, minimization, and an optional retention period. Never expose exact coordinates in lists by default.
- Address-book records begin as reviewable suggestions. Names never auto-merge; only exact stable identifiers may auto-link under the existing conservative matching rules.
- Add owner-controlled delete/export per enrichment item and a "revoke consent and delete captured data" action. Revocation stops future capture immediately.

### Rollout gates

1. Threat model, privacy copy, data inventory, retention/deletion design, and authorization review.
2. Settings toggles and immutable consent audit events; tests prove default-off and user boundary behavior.
3. One category at a time, starting with profile photo for selected participants; private-storage and deletion proof.
4. Message-attached location only; no live tracking; masking/reveal tests.
5. Address-book preview/import with explicit confirmation, selection, duplicate review, and no automatic People Directory merge.
6. Production acceptance with a legitimate user session, audit/export/deletion proof, and PII-safe telemetry review.

## Immediate next actions

1. Merge PR #142 only after CI/review threads are clean.
2. Reload the v1.0.8 unpacked extension and reproduce the screenshot conversation; record the returned conversation ID and captured sender/timestamp evidence.
3. Start core item 1 in a separate PR; do not mix optional enrichment with it.
4. Open a separate privacy/design decision before any optional enrichment implementation.
