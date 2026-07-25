# ConvoLens durable-intake alpha handoff — 2026-07-25

## Current checkpoint

- Branch: `main`
- Commit: `aee0b96` (`Make conversation intake durable (#120)`)
- Working tree at handoff: clean except for the pre-existing untracked
  `docs/HANDOFF-2026-07-24-EXTENSION-RUNTIME.md`; preserve it unless its owner
  explicitly decides to commit or remove it.
- PR #119 fixed the alpha positioning, landing/login journey, redirect loop,
  extension timeout UX, and first-run shell.
- PR #120 implemented durable conversation intake and is merged.
- Production has **not** been deployed from `aee0b96`.
- The remaining deployment gate is explicit operator confirmation of the
  recurring-cost Azure target:
  - subscription: `bb4e3882-2079-4bab-8974-611bc0b8bb58`
  - tenant: `9530cd32-9e33-47f0-9247-ed964730b580`
  - region: `southafricanorth`
  - PostgreSQL: Flexible Server 16, `B_Standard_B1ms`, 32 GiB, 7-day backup
  - estimated incremental cost: approximately USD 20.53/month before taxes,
    excess backup, and egress
  - existing resource-group budget: USD 75/month

## What PR #120 changed

### Durable API intake

- Added connector-neutral `ConversationIntake` and `ConversationMessage`
  entities.
- Added an explicit cross-SQLite/PostgreSQL migration bundled into the API
  runtime.
- Extension and `.txt` upload paths now save the intake and messages in one
  transaction before returning HTTP 200.
- Content-hash idempotency ignores connector-generated chat/message IDs and is
  enforced per user by a unique database index.
- Responses return a stable intake ID and dashboard URL.
- Added authenticated, user-scoped:
  - `GET /api/chat-export`
  - `GET /api/chat-export/:id`
- Added database-backed `GET /ready`; the Container App readiness probe and
  production smoke now use it.
- Added bounded PostgreSQL pooling and query/connection timeouts.

### Web first-run completion

- The web proxy now exchanges the Mystira Identity ID token at
  `/api/auth/mystira/exchange`; it no longer forwards the incompatible OAuth
  access token to ConvoLens.
- File-import success navigates to the stable stored record.
- The dashboard loads real user-scoped conversation records.
- `/dashboard/conversations/[id]` renders stored intake metadata and messages.

### Production infrastructure

- `enable_postgres = true` in the production Terraform profile.
- The deploy workflow:
  - checks `Standard_B1ms` availability in South Africa North;
  - runs database migrations during its API build smoke;
  - creates saved Terraform plans before both applies;
  - preserves the live API image during the base-infrastructure plan;
  - verifies `/ready` after rollout.
- The reusable infrastructure plan workflow now receives protected Terraform
  inputs and resolves the current production API image/port, preventing a
  misleading placeholder-image plan.

## Validation evidence

- API CI: 7 suites, 77 tests passed.
- New persistence/migration coverage: transaction, list/detail, user isolation,
  restart-safe duplicate identity, and SQLite migration.
- Production-mode runtime smoke:
  - submitted a two-message fixture;
  - listed it for the same user;
  - stopped and restarted the API;
  - reloaded the same stable intake;
  - resubmitted it and received the same intake ID with `duplicate: true`;
  - `/ready` reported `database: "ok"`.
- Web production build passed.
- Extension typecheck/build passed.
- Focused web auth and chunked-session tests: 7 passed.
- Terraform format and validation passed.
- Both modified workflows passed `actionlint`.
- PR #120 CI:
  - CI run `30135765394`
  - infrastructure validation run `30135765411`
- Protected OIDC production plan run `30135613432`:
  - resolved the current production API image and port;
  - `4 to add, 1 to change, 0 to destroy`;
  - additions are PostgreSQL server, database, Azure-services firewall rule,
    and the generated password in Key Vault;
  - the only update is the Container App database/readiness configuration;
  - no replacement and no runtime-image downgrade.

## Exact continuation

### 1. Confirm the recurring-cost target

Do not trigger provisioning until the operator explicitly confirms the
subscription, region, and PostgreSQL cost shown above.

### 2. Run the manual production deployment

Production remains manual and approval-gated; merging does not deploy.

```powershell
git switch main
git pull --ff-only
gh workflow run deploy-prod.yml --ref main
gh run list --workflow deploy-prod.yml --limit 3
gh run watch <run-id> --interval 10 --exit-status
```

The workflow must pass:

- PostgreSQL SKU availability
- API/web/extension-independent monorepo build
- API migration/startup smoke
- base Terraform plan/apply
- ACR API image build
- API-image Terraform plan/apply
- web package deployment
- `/ready`, frontend, and Mystira runtime-auth smoke

If the deploy fails, inspect the failed step before retrying:

```powershell
gh run view <run-id> --log-failed
```

### 3. Prove the deployed backing store

Verify Azure and public runtime state, not only the workflow conclusion:

```powershell
az postgres flexible-server show `
  --resource-group nl-prod-convolens-rg `
  --name nl-prod-convolens-pg `
  --query "{state:state,version:version,sku:sku.name,fqdn:fullyQualifiedDomainName}" `
  -o json

az containerapp show `
  --resource-group nl-prod-convolens-rg `
  --name nl-prod-convolens-api `
  --query "{revision:properties.latestReadyRevisionName,image:properties.template.containers[0].image,dbType:properties.template.containers[0].env[?name=='DB_TYPE'].value|[0]}" `
  -o json
```

Then verify:

- production API `/ready` returns HTTP 200 with `database: "ok"`;
- `https://convolens.neuralliquid.ai/` and `/features` return HTTP 200;
- `/api/runtime/auth-status` returns `mystiraConfigured: true`;
- the latest Container App revision is ready and receives 100% traffic.

### 4. Run the operator-held first-user journey

Use a fresh browser profile and a benign conversation the operator has
permission to upload.

1. Open `https://convolens.neuralliquid.ai/login?redirectTo=/dashboard`.
2. Complete Mystira sign-in and confirm there is no callback/login loop.
3. Upload a WhatsApp `.txt` export.
4. Confirm navigation to `/dashboard/conversations/<stable-id>`.
5. Confirm message count, participants, and stored messages.
6. Reload the page and sign out/in; the record must remain.
7. Submit the same export again; it must return the same record rather than
   create a duplicate.
8. Restart or revise the API, then reload the record again.
9. Repeat with the packaged extension on WhatsApp Web and confirm inline
   success—no blocking alert and no raw abort error.

No cookies, private message text, browser profiles, or session snapshots should
be retained in repository artifacts.

### 5. Record deployment proof

After the live proof passes:

- change `.azure/plan.md` status from
  `Validated — durable intake deployment pending` to the verified deployed
  state;
- add the deployment run ID, revision, image, PostgreSQL state/SKU, endpoint
  results, and authenticated intake/reload evidence;
- update `docs/ALPHA-GO-LIVE-ROADMAP.md` Stage 1 from code-complete to deployed;
- commit the documentation in a focused follow-up PR.

## Alpha boundaries still in force

This closes the durable-intake engineering gate only after production proof. It
does not make the external alpha ready by itself.

- No AI summary pipeline is connected to the intake yet. Continue calling this
  an intake technical preview; do not promise generated summaries.
- Privacy/terms, retention controls, deletion, and export remain stop-ship for
  an external cohort.
- Extension distribution is still invite-only/load-unpacked.
- The PostgreSQL firewall uses Azure's special `0.0.0.0` Azure-services rule;
  private networking is a later hardening step.
- A second connector, memory graph, source-linked artifacts, and accepted
  follow-up outcomes remain the work that can turn the current wedge into a
  defensible moat.
