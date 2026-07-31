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

- candidate service suite: 9/9;
- candidate, intake, and migration suite: 53/53;
- complete API Jest suite: 148/148;
- focused candidate UI plus Mystira auth/session suite: 5/5;
- headed Playwright persistence fixture: 1/1;
- headed extension UI/console fixtures: 4/4;
- monorepo build: 8/8;
- production Terraform validation: passed.

## Live boundary

The prior Phase 4 production deployment completed in run `30665499678` from merge `05e7fd222bc3e8ff51220c479bd654549cf3f13f`; Azure revision `nl-prod-convolens-api--0000040` is ready on that exact image and independent health returned HTTP 200.

This candidate/Baton slice is not deployed until its own PR is reviewed and merged. Authentic WhatsApp acceptance remains open because the staffed auth provisioner timed out waiting for WhatsApp Web to reach its chat list. No cookies or tokens were printed or copied, and no authentic conversation or Baton task is claimed by the synthetic fixture.
