# Grounded catch-ups and personal todos handoff

Date: 2026-08-03

## Restart here

Continue with Baton task `263ca89a-6c9d-4a74-a137-48dfc888b2e3` (Baton deep link: `/link/task-263ca89a`), **Deploy and authentically accept grounded catch-ups and personal todos**. It is a child of the existing serial go-live task `e518361c-fd6a-477c-83e9-91f7391cf73d` and is related to the completed implementation task `0f46847f-575d-4e95-9219-322bdc3cf484`.

Do not deploy, use an authenticated production session, publish a real Baton task, or delete production data without fresh exact authorization for that action.

## Landed outcome

PR [#173](https://github.com/neuralliquid/convolens/pull/173) merged to `main` as `94f71b7c159aa1c1e5bf85dbd048431378ef091f`.

The merged slice provides:

- durable, user-scoped conversation catch-ups with evidence references;
- a truthful synthetic cross-channel demo at `/demo/catch-up`;
- exact navigation from catch-up claims and todo drafts to stored message IDs;
- a private cross-conversation todo view at `/dashboard/todos`;
- deterministic draft generation from explicit action language only;
- edit/save, dismiss, confirm, return-to-review, and safe pre-publication deletion;
- a separate explicit Baton publish action after confirmation;
- durable revisions, idempotency markers, publication attempts, duplicate reconciliation, and retry-safe failure handling;
- protection against deleting a draft after it has entered Baton publication history.

The demo labels Email and Discord evidence as synthetic context. It does not claim live connector access and does not call Baton.

## Verification evidence

- exact PR head: `6a0f3e22ff3850f1660619b89adca33a17a61eba`;
- exact-head CI run: [30835756988](https://github.com/neuralliquid/convolens/actions/runs/30835756988), passed;
- Codex review covered that exact head and GraphQL reported zero review threads;
- merge commit: `94f71b7c159aa1c1e5bf85dbd048431378ef091f`;
- post-merge `main` CI run: [30836479830](https://github.com/neuralliquid/convolens/actions/runs/30836479830), passed;
- focused API suites: 20 tests passed across summary persistence, catch-up generation, and ticket candidates;
- focused web component suite: 3 tests passed;
- API production build: passed;
- web production build: passed with 27 routes, including `/dashboard/todos` and `/demo/catch-up`;
- focused ESLint and `git diff --check`: passed;
- headed browser verification of `/demo/catch-up`: todo preview and exact source links rendered, with zero console errors or warnings.

All five checklist items on implementation task `0f46847f-575d-4e95-9219-322bdc3cf484` are complete and that task is done.

## Foundry-through-Sluice continuation

The approved architecture is now:

```text
ConvoLens API -> Sluice capability alias -> Azure AI Foundry
```

The implementation is prepared but not yet merged or deployed in two clean
worktrees:

- Sluice: `C:\tmp\sluice-convolens-catch-up`, branch
  `agent/convolens-catch-up`;
- ConvoLens: `C:\tmp\convolens-personal-todos-acceptance`, branch
  `agent/personal-todos-production-acceptance`.

The Sluice change is published for review as
[phoenixvc/sluice#153](https://github.com/phoenixvc/sluice/pull/153). It must
land and deploy before the ConvoLens change can be deployed.

The Sluice slice declares `convolens-catch-up-v1`, a `convolens` virtual key
limited to that capability, bounded spend/rate limits, and global suppression
of prompt/response content in callbacks and OpenTelemetry. The alias initially
uses Sluice's existing Azure OpenAI deployment; ConvoLens does not receive a
Foundry/provider credential or select an upstream model.

The ConvoLens slice removes direct Azure OpenAI, OpenAI, and Anthropic fallback
from grounded catch-up generation. It requires `SLUICE_BASE_URL` plus the
restricted `SLUICE_API_KEY`, sends only bounded attribution metadata with an
opaque request ID, and fails closed with `AI_PROVIDER_NOT_CONFIGURED` otherwise.
Production Terraform stores the key in `nl-prod-convolens-kv` as
`sluice-api-key` and exposes it through a Container App secret reference.

Local evidence for this unmerged slice:

- Sluice Terraform validation: passed;
- Sluice virtual-key manifest parse and unique restricted alias check: passed;
- ConvoLens production Terraform validation: passed;
- catch-up generator suite: 6 tests passed;
- neighboring conversation-summary persistence suite: 2 tests passed;
- ConvoLens API production bundle: passed;
- focused source lint excluding the repository's unresolved missing
  `import/order` rule registration: passed;
- full API `tsc --noEmit` remains red for pre-existing controller/entity typing
  errors outside this slice; no reported error referenced a modified file.

## Current boundary

No deployment was performed for PR #173. CI, a production build, and the synthetic browser demo do not prove the authenticated production workflow.

Production summarization remains blocked until the two prepared changes land in
dependency order. Sluice must first deploy the capability alias and payload
privacy settings. A separately authorized operator must then reconcile
`scripts/keys.yaml`, capture the newly issued `vkey-convolens` without logging
it, and store it as the ConvoLens Production environment secret
`SLUICE_API_KEY`. Only then can the ConvoLens change be deployed. Deploying
ConvoLens first fails closed with `AI_PROVIDER_NOT_CONFIGURED`.

The following remain unverified for this merged build:

- deployed API/web build identity and configuration;
- legitimate authentication to `/dashboard/todos`;
- production draft persistence across refresh or restart;
- production user isolation;
- production navigation to the exact catch-up and supporting messages;
- production edit, dismiss, return-to-review, and pre-publication deletion;
- a separately authorized confirm-then-publish flow;
- exactly one real Baton task under retry/reload, with a persisted backlink;
- truthful UI behavior during an actual Baton outage or ambiguous create.

Do not use fabricated accounts, export or reuse session material, record conversation content, or promote synthetic evidence to authentic acceptance.

## Next bounded slice

1. Recheck live `origin/main`, PR #173, Baton task `263ca89a-6c9d-4a74-a137-48dfc888b2e3`, deployment state, and the primary checkout before acting.
2. Work in a clean isolated worktree from current `origin/main`; preserve unrelated primary-checkout state.
3. Merge and deploy the reviewed Sluice change first. Verify the rendered
   capability alias, payload-logging suppression, health, and unauthenticated
   `401` boundary without making a billable provider call.
4. Obtain separate exact authorization to reconcile the Sluice manifest and
   create `vkey-convolens`. Store it immediately as the ConvoLens Production
   environment secret `SLUICE_API_KEY`; never record the value.
5. Merge the ConvoLens change, obtain fresh explicit deployment authorization,
   and deploy only the exact intended `main` commit. Verify build identity,
   API/web health, Sluice configuration, and provider readiness independently.
   A healthy API with `AI_PROVIDER_NOT_CONFIGURED` is not feature readiness.
6. With a legitimate operator session and an authorized test conversation, generate grounded drafts and verify refresh persistence plus exact catch-up/message navigation.
7. Verify user isolation and edit, dismiss, return-to-review, and deletion before any publication history exists.
8. Obtain separate exact authorization for one production Baton write. Confirm the reviewed draft, publish once, then verify retry/reload produces exactly one task and preserves the backlink.
9. Record opaque IDs, timestamps, build identity, and outcomes only. Do not record tokens, cookies, participant names, conversation text, or stable WhatsApp identifiers.
10. Update the successor task checklist and add a repository-backed closeout. Do not close it from deployment health alone.

## Copy-paste restart

```powershell
Set-Location C:\Users\smitj\repos\convolens
git fetch origin --prune
git status --short --branch
git worktree list --porcelain
git log origin/main -3 --oneline --decorate

gh pr view 173 --repo neuralliquid/convolens `
  --json state,mergedAt,mergeCommit,headRefOid,url

gh run view 30836479830 --repo neuralliquid/convolens
```

Then read this file and Baton task `263ca89a-6c9d-4a74-a137-48dfc888b2e3` before choosing any deployment or staffed acceptance command.

## Workspace note

The primary checkout at `C:\Users\smitj\repos\convolens` and its unrelated
work were preserved. This continuation was implemented in the isolated
ConvoLens worktree `C:\tmp\convolens-personal-todos-acceptance`; the paired
Sluice change was prepared in `C:\tmp\sluice-convolens-catch-up`.
