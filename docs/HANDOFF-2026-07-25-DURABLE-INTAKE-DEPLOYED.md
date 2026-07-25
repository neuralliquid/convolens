# ConvoLens durable-intake deployment handoff — 2026-07-25

## Current checkpoint

- Production durable intake is deployed.
- Baseline commit before this handoff: `76f01e4`
  (`Use native PostgreSQL UUID generation (#123)`).
- Successful production workflow:
  [run 30140497889](https://github.com/neuralliquid/convolens/actions/runs/30140497889).
- Production API revision: `nl-prod-convolens-api--0000028`.
- Production API image:
  `nlprodconvolensacr.azurecr.io/convolens-api:76f01e419dc79097322759b0676374ca20299909`.
- The latest revision is also the latest ready revision, the Container App is
  running, and the latest revision receives 100% of traffic.
- Production uses PostgreSQL (`DB_TYPE=postgres`).
- The remaining acceptance gate is the operator-held authenticated intake,
  reload, duplicate, restart, and packaged-extension journey.
- Keep the canonical Baton root and Phases 3, 4, and 9 in progress until that
  journey passes.

## Live Azure state

Target:

- subscription: `bb4e3882-2079-4bab-8974-611bc0b8bb58`
- tenant: `9530cd32-9e33-47f0-9247-ed964730b580`
- resource group: `nl-prod-convolens-rg`
- region: `southafricanorth`

PostgreSQL:

- server: `nl-prod-convolens-pg`
- state: `Ready`
- version: PostgreSQL 16
- SKU: `Standard_B1ms`
- storage: 32 GiB
- backup retention: 7 days
- high availability: disabled
- FQDN: `nl-prod-convolens-pg.postgres.database.azure.com`

Verified runtime:

- API `/ready` returns HTTP 200 with:
  `{"status":"ready","database":"ok",...}`
- `https://convolens.neuralliquid.ai/` returns HTTP 200.
- `https://convolens.neuralliquid.ai/features` returns HTTP 200.
- `https://convolens.neuralliquid.ai/api/runtime/auth-status` returns HTTP 200
  with `{"mystiraConfigured":true}`.
- Production logs for revision `0000028` show:
  - `Database connection established`
  - `Database migrations completed`

## Cost posture

The deployed shape is already at the safe standalone cost floor:

- `Standard_B1ms` is the smallest Burstable PostgreSQL SKU exposed in South
  Africa North.
- 32 GiB is the minimum PostgreSQL storage allocation.
- Seven days is the minimum backup retention.
- ACR is already on Basic.
- The Container App has a zero minimum replica target.
- The web app is on B1, the lowest current tier used here that supports the
  custom-domain certificate.
- Redis remains disabled.

Estimated incremental PostgreSQL cost remains approximately USD 20.53/month
before taxes, excess backup, and egress, inside the existing USD 75
resource-group budget.

Reusing another product's PostgreSQL server was considered but rejected for
this deployment. It would reduce the incremental server charge at the cost of
cross-service credentials, ownership coupling, shared failure capacity, and
more complicated infrastructure state.

## Deployment recovery record

### Run 30137083074

- Failed before provisioning.
- Cause: the workflow queried PostgreSQL SKU names at the top level of the
  Azure CLI capability response.
- Current Azure CLI versions return SKU names under
  `supportedServerEditions[].supportedServerSkus[]`.
- No Azure infrastructure was changed by this run.
- Fixed by
  [PR #122](https://github.com/neuralliquid/convolens/pull/122).

### Run 30137359012

- Provisioned PostgreSQL successfully.
- Built and pushed the API image.
- Applied the API-image Terraform plan.
- Deployed the web package.
- Failed only at the final smoke step because the new API revision could not
  start.
- Production stayed on the previous ready API revision during the failed
  activation.
- Log Analytics showed the migration failure:
  `function uuid_generate_v4() does not exist`.

### PR #123 and run 30140497889

- [PR #123](https://github.com/neuralliquid/convolens/pull/123) configured
  TypeORM to use PostgreSQL's native `gen_random_uuid()` and disabled automatic
  extension installation.
- Focused UUID coverage passed.
- All 8 API suites and 78 tests passed.
- The API production build passed.
- Run `30140497889` completed both Terraform applies, image rollout, web
  deployment, and final smoke successfully.

## Canonical Baton state

Project: Convolens (`d20d739a-89b0-4a48-8f9b-dcb0724c149d`).

- Root — `ff10e352-c8ef-4e3b-a705-5dbe3698d93d`
  - `Convolens Azure go-live plan and production rollout`
  - status: `inprogress`
- Phase 3 — `6a48d4a9-bb12-410a-bab6-b7ecae53dc15`
  - `Convolens Phase 3 Postgres production data model`
  - status: `inprogress`
- Phase 4 — `c3020f7e-6be8-4b83-9dca-6d6afe9df4e2`
  - `Convolens Phase 4 WhatsApp extension and manual intake persistence`
  - status: `inprogress`
- Phase 9 — `e518361c-fd6a-477c-83e9-91f7391cf73d`
  - `Convolens Phase 9 serial go-live and handoff`
  - status: `inprogress`

The older Mystira-project tracker IDs in `.azure/plan.md` are superseded.
Continue from the canonical Convolens tasks above.

## Exact next task: operator acceptance

Use a fresh browser profile and a benign conversation the operator has
permission to upload.

1. Open
   `https://convolens.neuralliquid.ai/login?redirectTo=/dashboard`.
2. Complete Mystira sign-in and confirm there is no callback/login loop.
3. Upload a WhatsApp `.txt` export.
4. Confirm navigation to `/dashboard/conversations/<stable-id>`.
5. Confirm the stored message count, participants, and messages.
6. Reload the page.
7. Sign out and back in, then confirm the same record remains.
8. Submit the same export again and confirm the same stable record is returned
   instead of creating a duplicate.
9. Restart or revise the API, then reload the record again.
10. Repeat with the packaged extension on WhatsApp Web and confirm inline
    success without a blocking alert or raw abort error.

Do not retain cookies, private message text, browser profiles, or session
snapshots in repository artifacts.

## Closeout after operator acceptance

Only after the authenticated journey passes:

1. Update `.azure/plan.md`:
   - change `Validated — durable intake deployment pending` to the verified
     deployed state;
   - add run `30140497889`, revision `0000028`, image `76f01e4`, PostgreSQL
     state/SKU, endpoint results, and authenticated persistence evidence;
   - replace the superseded Baton tracker references with the canonical
     Convolens task IDs.
2. Update `docs/ALPHA-GO-LIVE-ROADMAP.md` Stage 1 from code-complete to deployed
   and operator-verified.
3. Add the acceptance evidence to the canonical Baton tasks.
4. Mark Phases 3 and 4 done if their persistence/extension exit criteria are
   satisfied.
5. Keep Phase 9 and the root open if privacy, retention/deletion, candidate
   extraction, or Baton publishing gates remain incomplete.
6. Publish those documentation updates in one focused follow-up PR.

## If the operator journey fails

Start with live state rather than rerunning the deployment blindly:

```powershell
gh run view 30140497889

az postgres flexible-server show `
  --resource-group nl-prod-convolens-rg `
  --name nl-prod-convolens-pg `
  --query "{state:state,version:version,sku:sku.name}" `
  -o json

az containerapp show `
  --resource-group nl-prod-convolens-rg `
  --name nl-prod-convolens-api `
  --query "{revision:properties.latestReadyRevisionName,image:properties.template.containers[0].image,traffic:properties.configuration.ingress.traffic}" `
  -o json
```

Then inspect the API revision's console and system logs. Do not destroy or
recreate PostgreSQL as part of application rollback.

## Alpha boundaries still in force

- No AI summary pipeline is connected to the stored intake yet.
- Continue calling this an intake technical preview.
- Privacy/terms, retention controls, deletion, and export remain stop-ship for
  an external cohort.
- Extension distribution remains invite-only/load-unpacked.
- The PostgreSQL firewall currently uses Azure's special `0.0.0.0`
  Azure-services rule; private networking is later hardening work.
- Candidate extraction/review and Baton publishing are not proven by this
  durable-intake deployment.

## Worktree note

At handoff creation, `main` was otherwise clean with the pre-existing untracked
`docs/HANDOFF-2026-07-24-EXTENSION-RUNTIME.md`. Preserve that file unless its
owner explicitly decides to commit or remove it.
