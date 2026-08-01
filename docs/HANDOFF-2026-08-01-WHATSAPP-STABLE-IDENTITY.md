# WhatsApp stable conversation identity handoff

Date: 2026-08-01

## Outcome

The implementation portion of Baton task `afabf0bd-5a6b-4272-b37a-b4bfd5601227` is complete on branch `agent/stable-whatsapp-identity`. Extension version `1.0.21` restores a privacy-safe stable identity source for the current WhatsApp Web runtime while remaining fail-closed.

Authentic intake acceptance is not complete. No conversation was uploaded, no production receipt or duplicate attempt exists, no deletion was performed, and no Baton candidate was published during this slice.

## Verified runtime source

The current WhatsApp DOM no longer exposes `data-jid` or `data-chat-id` for the active conversation. A headed, read-only inspection of the dedicated profile established that the active conversation header has React properties whose active `chat.id` and `chat.__x_id` values expose the WhatsApp JID. Participant and quoted-message identities exist elsewhere in the object graph and are deliberately ignored.

The shipped bridge:

- runs as a manifest-declared `MAIN`-world content script at `document_start`;
- requires Chrome 111 or newer, matching declarative `MAIN`-world support;
- reads only the active header's React properties and only the active chat model's `id`/`__x_id` serialized value;
- accepts only recognized WhatsApp JID domains and canonicalizes direct-chat `@c.us` identity;
- rejects missing or conflicting candidates;
- returns the JID to the isolated content script only through an ephemeral request/response event;
- does not store the page object graph, cookies, tokens, chat labels, participants, or message content;
- rechecks identity during collection and on chat DOM changes, invalidating an unconfirmed review when the verified identity changes or disappears.
- restores the bridge in `MAIN` before the isolated content script during popup self-healing after an extension reload, replacing any prior bridge listener.

This relies on a private WhatsApp React shape and may drift. Drift fails closed: confirmation remains unavailable and the status states that no data was sent.

## Evidence

Credential-free validation passed:

- extension unit/release suite: 152/152;
- extension TypeScript: passed;
- headed browser fixtures: 7/7, including current-DOM React identity, missing-identity refusal, and chat-change invalidation;
- persistence fixture: 1/1 across duplicate, API restart, owner isolation, and deletion;
- inspected production package: 14 expected ZIP payloads with matching sizes and CRCs;
- `git diff --check`: passed.

A final headed, read-only verification loaded the built extension into the dedicated profile and selected two visible chats. The bridge recognized a group `@g.us` identity, then a direct `@s.whatsapp.net` identity, and reported that the identity changed. The diagnostic emitted no JIDs, names, or messages and was removed after the run.

The existing authenticated no-send fixture reached WhatsApp and loaded the extension, but the ConvoLens web token in the dedicated profile had expired, so the capture control correctly remained at **Sign in to capture**. This is an authentication readiness result, not intake acceptance.

## Remaining staffed acceptance

Continue only with the dedicated profile and fresh operator participation:

1. Reauthenticate ConvoLens legitimately in the visible browser; do not export or expose the session.
2. Obtain a fresh exact authorization for one intake. The 2026-08-01 authorization used by the predecessor run is not reusable.
3. Run one zero-retry authentic intake and require the reviewed `sourceConversationId` to match the allowlisted target JID before confirmation.
4. Only after a production receipt exists, verify deterministic duplicate handling, session reload, API restart durability, owner isolation, authenticated deletion of both row and raw artifact, candidate generation, and exactly one approved Baton publication.
5. Record only opaque IDs, timestamps, build identity, and outcomes. Do not record cookies, tokens, chat content, participant names, message text, or the WhatsApp JID.

Cloud deployment, Chrome Web Store publication, session export, and bypassing the stable-identity guard remain out of scope unless separately authorized.

## Workspace

The dirty primary checkout was preserved. Work was performed in `C:\tmp\convolens-stable-identity` from current `origin/main`.
