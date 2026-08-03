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

## Current boundary

No deployment was performed for PR #173. CI, a production build, and the synthetic browser demo do not prove the authenticated production workflow.

Production summarization configuration is a confirmed blocker. `activeProvider()` in `apps/api/src/services/ai/catch-up-generator.service.ts` requires either both `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`. The tracked production Container App in `infra/terraform/env/prod/main.tf` currently provisions none of them. Deploying the current Terraform unchanged would leave catch-up generation unavailable with `AI_PROVIDER_NOT_CONFIGURED` even if health probes pass.

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
3. Resolve the summarization-provider blocker before deployment acceptance: select an approved provider, provision its secret through the governed Key Vault/Terraform path, bind only the required Container App environment variables, and validate that no secret enters Git, logs, plans, or handoff evidence. This provider choice and secret write require explicit authorization.
4. Obtain fresh explicit deployment authorization. Deploy only the exact intended `main` commit and verify build identity, API/web health, provider readiness, and relevant configuration independently. A healthy API with `AI_PROVIDER_NOT_CONFIGURED` is not feature readiness.
5. With a legitimate operator session and an authorized test conversation, generate grounded drafts and verify refresh persistence plus exact catch-up/message navigation.
6. Verify user isolation and edit, dismiss, return-to-review, and deletion before any publication history exists.
7. Obtain separate exact authorization for one production Baton write. Confirm the reviewed draft, publish once, then verify retry/reload produces exactly one task and preserves the backlink.
8. Record opaque IDs, timestamps, build identity, and outcomes only. Do not record tokens, cookies, participant names, conversation text, or stable WhatsApp identifiers.
9. Update the successor task checklist and add a repository-backed closeout. Do not close it from deployment health alone.

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

The stale primary checkout at `C:\Users\smitj\repos\convolens` and its unrelated untracked handoff file were preserved. Implementation and this handoff were prepared in the isolated worktree `C:\tmp\convolens-catch-up`.
