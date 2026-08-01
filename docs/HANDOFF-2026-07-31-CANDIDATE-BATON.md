# Candidate review and Baton publication handoff

Date: 2026-07-31
Updated: 2026-08-01

## Outcome

This slice implements the Phase 5/6 prerequisite for the serial go-live:

- normalized WhatsApp messages produce deterministic ticket candidates only from explicit action language;
- every candidate retains a source-message position/id/timestamp span and confidence;
- generation is idempotent and owner-scoped;
- the conversation UI supports edit, project selection, accept, reject, and an additional explicit publish action;
- no candidate publishes before acceptance;
- accepted candidates publish through the current user's server-held Mystira session, without a stored Baton credential;
- accepted candidates become immutable and render read-only, so edits require a fresh review decision;
- candidate and intake publication claims use reclaimable 90-second leases and serialize deletion with remote publication;
- any completed durable Baton attempt carrying a task ID finalizes the candidate locally before any recovery path can call Baton again, including attempts later marked failed by local finalization errors;
- the Baton create boundary is persisted before POST; first stale recovery converts `baton_create_started` into a fresh durable ambiguity boundary so the full reconciliation window occurs after the publication lease expires and before any later POST;
- after claiming publication, the service reloads attempts; the pre-POST boundary atomically renews both intake and candidate claims, and terminal attempt/candidate writes are transactional so a delayed stale publisher cannot create or finalize under a reclaimed claim;
- stale deletion cleanup CAS-compares both the Baton claim ID and its observed lease timestamp, so a concurrent pre-POST renewal forces deletion to reload and block;
- deletion re-anchors a stale `baton_create_started` boundary into a fresh `baton_ambiguous` safety window; reclaiming a stale recovery lease and refreshing its stranded ambiguity boundary occur in one database transaction, so concurrent deleters cannot observe a gap. Deletion blocks while an unreconciled boundary remains inside that window, preserving the candidate, idempotency marker, and attempt evidence until a retry can reconcile safely; already reconciled successful candidates are not held by historical ambiguity rows;
- stale publication reclaim uses the same claim-ID-plus-observed-timestamp CAS, so it cannot overwrite or later clear a concurrently renewed intake lease;
- Baton project IDs are normalized and UUID-validated before candidate update or acceptance persistence;
- ambiguous Baton creates retain the original reconciliation deadline across lookup failures, never issue an immediate second POST, and permit a new create only after that deadline expires without a visible duplicate;
- Mystira access-token expiry is tracked independently from ID-token expiry before the token is forwarded;
- the publish proxy resolves one refreshed Mystira session and derives both downstream credentials from it;
- persisted task links use the authenticated Baton frontend at `https://baton.phoenixvc.tech/tasks/:id`, not the bearer-only API;
- Accept is disabled while candidate edits are unsaved, preventing reviewed text from being silently replaced by persisted text;
- a durable idempotency marker and remote duplicate check reconcile ambiguous timeouts;
- publication attempts, failures, retries, task ids, and links are persisted;
- an admin-only retry endpoint is available in addition to the owner retry control;
- deleting the source intake cascades its local candidates and attempt audit.
- launcher placement now uses explicit, accessible Height and Side segmented controls with visible selected state instead of an ambiguous edge-action link.

The canonical Baton API is configured as `https://baton-backend.up.railway.app`, with the Convolens project `d20d739a-89b0-4a48-8f9b-dcb0724c149d` as the editable default suggestion.

## Repeatable evidence

The headed persistence fixture now exercises the production extension, built API, SQLite restart, and a loopback Baton HTTP stub. It proves capture, raw/normalized persistence, deterministic candidate generation, human-style acceptance/project selection, one remote task on publish replay, cross-owner isolation, restart persistence, and deletion without making an external task.

Validated locally:

- candidate service suite: 13/13;
- candidate, intake, and migration suite: 62/62;
- complete API Jest suite: 157/157;
- focused candidate UI plus Mystira auth/session suite: 5/5;
- headed Playwright persistence fixture: 1/1;
- headed authenticated Playwright no-send fixture: 1/1, with the guarded send case skipped;
- headed extension UI/console fixtures: 5/5, including persisted launcher height/side interaction;
- extension unit and release-evidence suite: 149/149;
- monorepo build: 8/8;
- production Terraform validation: passed.

## Live boundary

PR #162 merged as `8eaa6d7fc68947d7b119603d19f008f3079305bd`. Production deployment run `30693790497` completed successfully from that exact merge, including API/web build, Terraform applies, API image rollout, web deployment, and smoke tests. Independent verification confirmed Azure revision `nl-prod-convolens-api--0000042` ready on image `nlprodconvolensacr.azurecr.io/convolens-api:8eaa6d7fc68947d7b119603d19f008f3079305bd`; API `/health` and `/ready`, web `/features`, and web `/api/runtime/auth-status` returned HTTP 200, with `mystiraConfigured: true`.

PR #163 merged the test-only auth-fixture follow-up as `31a31d3fa79d9aa9cdb712c8f6e06e46eb938aa3`. Authentic provisioning and no-send acceptance now share the production WhatsApp readiness selectors while keeping allowlisted target-chat selection separately scoped. No additional production deployment is required for that test-only change.

Two initial staffed provisioning attempts used only the dedicated profile outside the repository and timed out because no WhatsApp chat-list readiness selector became visible. A later staffed retry succeeded, provisioned `C:\Users\smitj\AppData\Local\ConvoLens\Playwright\acceptance-profile`, and the headed authenticated no-send fixture passed against real WhatsApp and ConvoLens sessions. No cookies or tokens were printed or copied.

Authentic send/persistence acceptance remains open. On 2026-08-01 the operator supplied the exact one-intake confirmation and authorized any visible chat. The guarded runner selected a real chat, completed loaded-message review, and stopped before confirmation because the reviewed payload contained no stable `sourceConversationId`. A follow-up read-only redacted DOM-shape check found no `data-jid` or `data-chat-id` in either the active conversation or sidebar, and current message `data-id` values were opaque rather than WhatsApp JIDs. Scanning the first 20 visible chats found no supported stable identity. No authentic conversation upload or Baton task occurred.

The remaining blocker is current WhatsApp compatibility for stable conversation identity. Do not weaken the guard or substitute a display label. Until a verified stable JID source is implemented and covered by fixtures, duplicate submission, session reload, production restart persistence, and one-task Baton replay remain operator-held.
