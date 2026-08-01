# Candidate review and Baton publication handoff

Date: 2026-07-31

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
- deletion also blocks while a durable `baton_create_started` or `baton_ambiguous` boundary remains inside its reconciliation safety window, preserving the candidate, idempotency marker, and attempt evidence until a retry can reconcile safely;
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

The canonical Baton API is configured as `https://baton-backend.up.railway.app`, with the Convolens project `d20d739a-89b0-4a48-8f9b-dcb0724c149d` as the editable default suggestion.

## Repeatable evidence

The headed persistence fixture now exercises the production extension, built API, SQLite restart, and a loopback Baton HTTP stub. It proves capture, raw/normalized persistence, deterministic candidate generation, human-style acceptance/project selection, one remote task on publish replay, cross-owner isolation, restart persistence, and deletion without making an external task.

Validated locally:

- candidate service suite: 13/13;
- candidate, intake, and migration suite: 59/59;
- complete API Jest suite: 154/154;
- focused candidate UI plus Mystira auth/session suite: 5/5;
- headed Playwright persistence fixture: 1/1;
- headed extension UI/console fixtures: 4/4;
- monorepo build: 8/8;
- production Terraform validation: passed.

## Live boundary

The prior Phase 4 production deployment completed in run `30665499678` from merge `05e7fd222bc3e8ff51220c479bd654549cf3f13f`; Azure revision `nl-prod-convolens-api--0000040` is ready on that exact image and independent health returned HTTP 200.

This candidate/Baton slice is not deployed until its own PR is reviewed and merged. Authentic WhatsApp acceptance remains open because the staffed auth provisioner timed out waiting for WhatsApp Web to reach its chat list. No cookies or tokens were printed or copied, and no authentic conversation or Baton task is claimed by the synthetic fixture.
