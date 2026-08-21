# ConvoLens Azure Go-Live Plan

Status: Approved for preparation — validation findings remain open
Recipe: Terraform
Date: 2026-07-16
Target subscription: neuralliquid-sub (5a95ddee-dd63-441a-8306-c8b0803dcdd4)
Target tenant: 5384ef74-e517-4b22-9472-df990f61e8b5
Target region: southafricanorth (approved for the isolated blue-green target)
Target hostname: convolens.neuralliquid.ai

## 2026-08-21 target-correction addendum

This addendum supersedes the subscription and tenant fields in the historical plan below. The
older validation and deployment proof remains evidence for the currently live Mystira-hosted
stack only; it does not authorize or validate a deployment into `neuralliquid-sub`.

### Corrected objective and mode

- Mode: MODIFY an existing production Azure application by moving its web/API/storage/telemetry
  deployment target to `neuralliquid-sub`.
- Classification: production, small scale, cost-optimized within the existing USD 75 monthly
  resource-group budget.
- Data constraints: WhatsApp exports and transcripts remain sensitive; current retention,
  deletion, private-storage, managed-identity, and no-content-telemetry controls remain mandatory.
- Voice-note activation remains fail-closed until xtox accepts a legitimate ConvoLens token,
  verifies `retain=false`, and an authentic configured-hostname request reaches Sluice/Foundry.

### Authoritative current-state evidence

- Azure confirms `5a95ddee-dd63-441a-8306-c8b0803dcdd4` is enabled as
  `neuralliquid-sub` in tenant `5384ef74-e517-4b22-9472-df990f61e8b5`.
- No ConvoLens resource group or planned application resource currently exists in that
  subscription.
- The `neuralliquid.ai` Azure DNS zone is already owned there in `nl-global-shared-rg`.
- `convolens.neuralliquid.ai` currently points to
  `nl-prod-convolens-web.azurewebsites.net`, the live Mystira-hosted web app.
- The existing GitHub Production environment still targets subscription
  `bb4e3882-2079-4bab-8974-611bc0b8bb58`, tenant
  `9530cd32-9e33-47f0-9247-ed964730b580`, and client
  `8f57a349-eb88-40fd-81eb-1065f84e668b`. Dispatching it unchanged would deploy to the wrong
  subscription.
- The live `nl-prod-shared-pg` PostgreSQL 16 server remains in the Mystira subscription. It is
  ready in South Africa North, permits Azure-service traffic, and its scoped ConvoLens password
  exists in the old ConvoLens Key Vault. The first blue-green target can reuse this source of
  truth without a data copy, but the secret must be transferred directly between vaults without
  printing or persisting it.
- Existing globally scoped storage and ACR names are unavailable because the live stack owns them.
  Verified available blue-green names are `nltfstateconvolensnl`,
  `nlprodconvolensnlst`, `nlprodconvolensnlacr`, and
  `nl-prod-convolens-nl-kv`. The proposed web app name is
  `nl-prod-convolens-web-nl`.
- South Africa North is advertised for Container Apps managed environments and Linux App Service
  B1 in this subscription.
- At 2026-08-21T08:10Z, `litellm.sluice.phoenixvc.tech` resolved to the new South Africa North
  Sluice Container App and returned HTTP 401 over HTTPS without credentials. This proves the
  production DNS, TLS, and unauthenticated routing boundary now reach the new stack; it does not
  prove an authenticated Whisper request.
- xtox PR #22 merged as `d9147c9f5b07d4a47a99ab999606da0bc334df96`, and exact post-merge
  deployment run `32465908392` succeeded. `api.xtox.celladoresystems.com` now completes TLS and an
  unauthenticated `POST /api/transcribe-audio?retain=false` returns 401, proving the real hostname
  routes to the fail-closed auth boundary. PR #23 is reconciling the managed-certificate binding
  in Terraform state. Authenticated Sluice/Foundry execution and the route-scoped ConvoLens token
  contract remain independent activation gates.

### Proposed blue-green architecture

Keep subscription-scoped names such as `nl-prod-convolens-rg`, the Container Apps environment,
and the API app name. Add a configurable global-name suffix only to resources whose public/global
names collide: Terraform state storage, application storage, ACR, Key Vault, and App Service.

The deployment sequence is:

1. Register required resource providers and create a least-privilege GitHub OIDC deployment
   identity in tenant `5384ef74-e517-4b22-9472-df990f61e8b5`.
2. Add a separate GitHub environment for the neuralliquid target rather than overwriting the live
   Mystira Production variables.
3. Use a distinct Terraform backend and state key in `nltfstateconvolensnl`; never point the new
   subscription at the old state.
4. Provision the new stack without changing DNS or deleting the live stack.
5. Transfer required secrets directly into the new Key Vault, including the scoped shared
   PostgreSQL credential, without exposing values in logs, files, Terraform state, or chat.
6. Deploy merge commit `e85b20a2e2fb9be16958a26bf0d77061232567a9` with voice
   transcription disabled.
7. Verify build identity, migrations, API readiness, web auth configuration, protected-route
   failure behavior, storage access, and telemetry on Azure-assigned hostnames.
8. Bind and validate the canonical hostname on the new web app, then perform an explicit DNS
   cutover with rollback to the old CNAME retained.
9. Keep the old stack intact until authentic acceptance and an agreed observation period complete.
   Old resource deletion is separate destructive work and is not authorized by this plan.

### Resource inventory and provisioning-limit status

Current South Africa North counts in `neuralliquid-sub` are zero for every planned application
resource type.

| Resource type                                  |   Planned |   Total after | Current limit/evidence                                                          | Status                                  |
| ---------------------------------------------- | --------: | ------------: | ------------------------------------------------------------------------------- | --------------------------------------- |
| Microsoft.App/managedEnvironments              |         1 |             1 | Quota API limit is 20 in South Africa North                                     | Supported                               |
| Microsoft.App/containerApps                    |         1 |             1 | Provider registered; managed-environment location and quota verified            | Supported                               |
| Microsoft.Web/serverFarms (Linux B1)           |         1 |             1 | `az appservice list-locations` includes South Africa North                      | Supported                               |
| Microsoft.Web/sites                            |         1 |             1 | No existing web apps in-region; collision-free blue-green name required         | Supported pending name check            |
| Microsoft.Storage/storageAccounts              |         2 |             2 | Zero existing in-region; both proposed global names are available               | Within documented default account limit |
| Microsoft.ContainerRegistry/registries (Basic) |         1 |             1 | Provider registered; zero existing in-region; proposed global name is available | Supported                               |
| Microsoft.KeyVault/vaults                      |         1 |             1 | Zero existing in-region; proposed global name is available                      | Within documented service limit         |
| Microsoft.OperationalInsights/workspaces       |         1 |             1 | Zero existing in-region                                                         | Within documented service limit         |
| Microsoft.Insights/components                  |         1 |             1 | Zero existing in-region                                                         | Within documented service limit         |
| Microsoft.Authorization/roleAssignments        | 7 peak / 6 steady | 7 peak / 6 steady | Provider registered; far below subscription limit                         | Supported                               |
| Microsoft.Network/dnszones record sets         | 2 changes | Existing zone | Zone is already in target subscription                                          | Cutover step only                       |
| Microsoft.DBforPostgreSQL/flexibleServers      |         0 |             0 | Reuse existing scoped database in Mystira subscription                          | No new quota required                   |
| Microsoft.Cache/Redis                          |         0 |             0 | Disabled                                                                        | Not applicable                          |

`Microsoft.App`, `Microsoft.ContainerRegistry`, `Microsoft.KeyVault`, `Microsoft.Storage`,
`Microsoft.OperationalInsights`, and `Microsoft.Quota` are registered in the target subscription.
The final no-refresh target plan contains 26 creates, zero changes, and zero destroys, including
six steady-state scoped role assignments: four for the API identity, one for the frontend identity,
and one permanent read-only deployment-principal assignment. Bootstrap and the first base apply can
temporarily add a seventh Secrets Officer assignment for direct secret transfer. The corresponding read-only
legacy-state plan recognizes the explicit address moves and contains zero destroys (its three
changes are expected placeholder/runtime-input differences in the validation command). That
is configuration evidence only; it does not authorize apply or prove runtime readiness.

### Open validation findings before deployment

1. The new target now references `api-jwt-secret`, `sluice-api-key`, and the shared PostgreSQL
   password out of band, and uses a separate bootstrap-only workflow for state storage plus Key
   Vault/RBAC. After that reviewed bootstrap, all five required secrets must be transferred
   directly into the target vault without printing them; the deploy workflow only verifies names.
2. A user-assigned API identity and `AcrPull` replace first-run system-identity and ACR-admin
   credential cycles for the blue-green target. Exact target and legacy-state plans must still be
   captured in CI before deployment.
3. Authentic sign-in cannot be proved on the Azure-assigned hostname while `NEXTAUTH_URL`, CORS,
   and the Identity redirect URI remain canonical-host-only. Before cutover, either authorize a
   temporary validation hostname and matching Identity redirect URI, or treat authenticated
   validation as a cutover gate with an immediate rollback path. Azure health alone is not user
   acceptance.
4. The production dispatch must be restricted to `refs/heads/main`, and both protected GitHub
   environments must enforce deployment-branch policy, before either can receive OIDC and secrets.

The `Production-NeuralLiquid` GitHub environment now exists with a custom `main`-only branch
policy. Entra application client `bad4e43a-1835-45e4-b635-46edb722f4b0` has an environment-scoped
federated credential for `repo:neuralliquid/convolens:environment:Production-NeuralLiquid`; its
service principal is intentionally not yet granted Azure deployment roles, so neither bootstrap
nor deploy can run until reviewed least-privilege assignments are approved.

The bootstrap plan grants the deployment principal permanent `Key Vault Secrets User` access and a
separate temporary `Key Vault Secrets Officer` assignment for direct secret transfer. On the first
full deployment, the workflow retains the temporary write assignment through the base apply only
when the Terraform-managed App Insights secret does not yet exist, then removes only that assignment.
It verifies the permanent read role with a bounded secret-read retry before continuing. A failed
first base apply can leave the temporary Officer assignment in place and therefore requires either a
successful rerun or an explicit reviewed revocation; a missing permanent read assignment is repaired
by rerunning the reviewed bootstrap workflow.

### Approval checkpoint for the corrected target

Approval of this addendum authorizes preparation only: provider registration, isolated
Terraform/workflow changes, OIDC identity setup for the new tenant, validation, and a reviewed
blue-green plan. It does not authorize DNS cutover, removal of the live Mystira stack, secret
disclosure, voice-transcription activation, or fabricated user acceptance.

Approval received in-thread on 2026-08-21 when the user directed the agent to address the pending
`neuralliquid-sub` deployment-plan approval together with the xtox production blockers. The
approved context is subscription `5a95ddee-dd63-441a-8306-c8b0803dcdd4`, location
`southafricanorth`, and temporary reuse of the existing scoped PostgreSQL database during the
blue-green deployment. The exclusions above remain in force.

## 1. Objective

Put Convolens live on the Mystira Azure subscription as a production service that can ingest WhatsApp conversation data and create actionable Baton intake items from that data.

The go-live is not just hosting the current app. The production target must include:

- a public web experience;
- a durable API runtime;
- production storage and database behavior;
- secure secret and identity management;
- observable health, logs, and alerts;
- a verified WhatsApp ingestion path;
- a verified Baton task/intake path;
- CI/CD with preview, validation, deployment, and rollback steps.

## 2. Current Evidence

Repository shape:

- Monorepo with `apps/web`, `apps/api`, `apps/chrome-extension`, shared packages, tests, and Terraform.
- Existing Terraform is under `infra/terraform/env/dev`.
- Existing dev environment provisions resource group, Log Analytics, Application Insights, Storage, Cosmos DB, Key Vault, Container Apps, Static Web App, optional Redis, optional Azure OpenAI, and optional budget alerts.
- Existing dev Azure resources include `nl-dev-convolens-rg` in `eastus2`.
- Convolens should stay under the NeuralLiquid `nl-*` resource naming family even though it is deployed in the Mystira Azure subscription.
- The go-live target is straight to `prod`; there is no separate dev environment for this deployment cycle. For now, `prod` is the effective development and production environment.
- Mystira production resources in the active subscription are primarily in `southafricanorth`; Convolens should also use `southafricanorth` wherever possible.

Important code findings:

- API database config is currently SQLite (`database.sqlite`) with production migrations enabled, which is not a production Azure data plan.
- Terraform provisions Cosmos DB, but the API does not currently use Cosmos through TypeORM or a repository layer.
- Chat export upload and Chrome extension ingestion parse/validate WhatsApp data, but both still have TODOs for durable persistence and summarization queueing.
- Current Puppeteer-based WhatsApp Web client is not production-ready as-is: it launches non-headless and depends on interactive QR/session state.
- Storage service can use Azure Blob Storage, but it uses direct REST/shared key style paths that should be replaced or hardened with Azure SDK and managed identity for production.
- Extension selector reports are held in memory; production needs persistent storage and admin access control.

Baton consultation:

- Baton org-wide health/search endpoints returned 502 during planning.
- Narrow task search worked.
- Existing WhatsApp-related Mystira tasks found were completed:
  - `a86ec55e-834d-4c6a-810e-0052728f4cfc` - Analyze Mystira decision-maker WhatsApp export.
  - `ec2b4119-7464-406d-bd77-f196502fa075` - Triage WhatsApp support business group behavior.
  - `7ca8db3c-135c-4692-8fdf-2bfe14beee5c` - Ship WhatsApp support link in PWA.
- No open Convolens tracker was found by title search.
- No existing Baton intake tracker was found by `intake` or `Baton intake` title search.

## 3. Target Architecture

Recommended production shape:

- Frontend: Azure App Service is the recommended target because the app is a Next.js application with auth/runtime needs; Static Web Apps remains acceptable only if the production build is confirmed to be fully static or SWA-compatible.
- API: Azure Container Apps, with min replicas greater than zero for production.
- Database: PostgreSQL is the recommended production source of truth for the first go-live because the API already uses TypeORM entities/migrations and needs durable relational workflow state for ingestion, review, Baton publishing, and audit. Cosmos DB remains useful later for high-volume message/document storage if needed, but using it first would require a bigger repository-layer rewrite.
- Storage: Azure Blob Storage for uploaded WhatsApp exports, normalized artifacts, and processing outputs.
- Queue: Azure Service Bus or Storage Queue for ingestion and Baton task creation work.
- Secrets: Key Vault with managed identity access from API/worker and GitHub OIDC for deployments.
- Telemetry: Application Insights and Log Analytics with app health, ingestion failures, Baton API failures, queue depth, and auth failures.
- Auth: Mystira Identity / Entra OIDC for web/operator login, following the already-used sibling-service pattern.
- Budget and cost tags: production budget enabled, cost tags aligned with NeuralLiquid/Mystira cost tracking.
- DNS: `convolens.neuralliquid.ai`, with API CORS locked to that origin and any required callback origin.

## 4. Production Environment Work

Create a `prod` Terraform environment and deploy directly to it:

- Add `infra/terraform/env/prod`.
- Use `env = "prod"` and `org = "nl"`.
- Use `southafricanorth` wherever possible.
- Use a separate Terraform state key, for example `convolens-prod.tfstate`, under the existing remote-state pattern or the Mystira shared tfstate standard.
- Ensure production Key Vault has purge protection enabled.
- Enable budget alerts with a real admin email.
- Create a dedicated resource group `nl-prod-convolens-rg` for blast-radius and cost clarity.
- Add deployment outputs for web URL, API URL, Key Vault, App Insights, and resource group.

Production Terraform gaps to close:

- Replace placeholder API image default with a required input or CI-produced image.
- Add ACR or reuse the existing shared ACR if policy allows; keep resource names and tags `nl-prod-convolens-*` where Convolens owns the resource.
- Add managed identity role assignments for storage, Key Vault, queue, and database.
- Disable or reduce shared-key dependency where possible.
- Tighten public network defaults where supported.
- Add Container Apps secret references from Key Vault or secure app secrets.
- Add health probes and startup/liveness behavior for Container Apps.
- Add autoscale rules that include HTTP concurrency and queue depth once queue processing exists.

## 5. Code Readiness Work

Blockers before production deployment:

- Replace SQLite production data path with Cosmos or PostgreSQL.
- Add Mystira Identity OIDC integration:
  - register Convolens as an OIDC relying party/client;
  - configure callback/logout redirect URIs for `https://convolens.neuralliquid.ai`;
  - store client secret in Key Vault or GitHub environment secret as appropriate;
  - require authenticated sessions for import/review/publish flows.
- Implement durable save for `/api/chat-export/upload`.
- Implement durable save for `/api/chat-export/extension`.
- Add idempotent ingestion records keyed by user, chat id/export hash, source, and time window.
- Add persistence for extension selector reports.
- Harden auth around admin-only endpoints (`/api/extension/selectors/reports`, selector update).
- Add production CORS configuration for final web/API hosts.
- Add structured health endpoints:
  - `/health/live` for process health.
  - `/health/ready` for database/storage/queue readiness.
  - `/health/dependencies` protected or internal for detailed dependency status.
- Add migration/seed strategy for the selected database.
- Add a production build smoke test for API Docker image and frontend build.

## 6. WhatsApp Intake Into Baton

This is a first-class go-live feature, not a post-launch nicety.

Target workflow:

1. Chrome extension sends structured chat data, with manual export upload retained as a fallback/admin import path.
2. API validates, sanitizes, hashes, and persists the raw artifact and normalized messages.
3. API creates an ingestion job.
4. Worker summarizes/extracts actionable items from the conversation.
5. Worker maps extracted items into Baton-ready task candidates and recommends the target Baton project.
6. Human review gate approves, edits, rejects, or bulk-publishes candidates.
7. Approved candidates are created in Baton with source metadata, trace id, chat/date range, confidence, and audit note.
8. Baton task ids are written back to the Convolens ingestion record.

Required Baton integration behavior:

- Route Baton intakes into the relevant Baton project rather than one global inbox.
- Use the active Mystira project (`7ebf10db-5261-408a-9db2-8ba14d4110b7`) as the default when a candidate is product/Mystira-specific or the project is ambiguous.
- Route clear platform/service items to their project when identifiable, for example Sluice, Docket, Baton, Retort, HOV, or Cognitive Mesh.
- Stage candidates for review before creating Baton tasks. Direct-create should be opt-in later for trusted extraction classes only.
- Define task fields:
  - title
  - description
  - source chat/export id
  - source timestamp range
  - priority
  - owner type
  - labels
  - parent task or epic relation when known
  - trace id
- Add duplicate prevention across Baton by checking for existing tasks with the same source hash or normalized title before creation.
- Add failure handling for Baton 502/timeout responses:
  - retry with backoff;
  - leave job in `pending_baton`;
  - expose a retry UI/admin action;
  - never lose the extracted candidate.

Minimal go-live slice for WhatsApp-to-Baton:

- Chrome extension extraction works against the selected WhatsApp source and submits to production API.
- Manual export upload works as fallback.
- Messages are persisted.
- Candidate extraction produces reviewable items.
- Reviewer can publish selected candidates to Baton.
- Baton write result is persisted and auditable.
- Failed Baton calls are retryable.

Do not rely on the Puppeteer WhatsApp Web client for production go-live unless a separate security/session/runbook decision is made. The Chrome extension path is the recommended first-class ingestion path; manual export is the fallback.

## 7. Security and Compliance

### Validation Proof — 2026-07-24

- Approved subscription `bb4e3882-2079-4bab-8974-611bc0b8bb58` and tenant `9530cd32-9e33-47f0-9247-ed964730b580` were confirmed enabled through Azure CLI and Azure MCP.
- `terraform -chdir=infra/terraform/env/prod init -backend-config=backend.hcl -input=false` succeeded against the production remote backend.
- `terraform -chdir=infra/terraform/env/prod fmt -check -recursive` and `terraform -chdir=infra/terraform/env/prod validate` passed with Terraform 1.14.7, matching the production workflow.
- `terraform -chdir=infra/terraform/env/prod state list` returned the expected production App Service, Container App, storage, Key Vault, telemetry, registry, queue, and role-assignment resources.
- Azure Policy assignment validation found only the default Defender for Cloud audit initiative and no deny assignment blocking the deployment.
- A final no-refresh production plan using the current API image and port reported `0 to add, 2 to change, 0 to destroy`. The expected in-place changes add the Mystira API validation settings, Key Vault references, and `offline_access` for web token refresh.
- An earlier live-refresh validation rendered the two protected web values into transient local output. Its saved plan was securely deleted, and a targeted remote-state inspection confirmed neither value is stored in Terraform state.
- Credential rotation was deferred by the operator for this deployment. The existing protected GitHub production values remain in use and should be rotated in a later maintenance window.
- App Service uses non-secret Key Vault references for the protected web settings. The deployment workflow writes their values directly from the protected GitHub environment into Key Vault, keeping the values out of Terraform configuration, plan output, and state.
- Main CI run `30115398626` passed for merge commit `f267b0e`; focused API auth tests, web token-refresh tests, API/web builds, extension packaging, Prettier, targeted lint, and `git diff --check` also passed.
- Pre-deployment public checks returned HTTP 200 for `/features`, `/api/runtime/auth-status` with `mystiraConfigured: true`, and the production API `/health`.

### Durable Intake Validation Proof — 2026-07-25

- Production target remains the approved subscription `bb4e3882-2079-4bab-8974-611bc0b8bb58`, tenant `9530cd32-9e33-47f0-9247-ed964730b580`, and South Africa North region.
- API CI passed all 7 suites and 77 tests, including transaction, durable idempotency, user isolation, and SQLite migration coverage.
- A production-mode runtime smoke proved add, list, restart, reload, stable duplicate detection, and database-backed `/ready` behavior.
- Web production build, extension typecheck/build, focused web auth/session tests, Terraform format/validate, and workflow lint all passed.
- Protected OIDC infrastructure plan run `30135613432` resolved the current production API image and target port before planning.
- The reviewed production plan is limited to `4 to add, 1 to change, 0 to destroy`: PostgreSQL Flexible Server `B_Standard_B1ms`, the `convolens` database, its Azure-services firewall rule, the generated password in Key Vault, and an in-place API database/readiness configuration update.
- Estimated recurring PostgreSQL compute and 32 GiB storage cost is approximately USD 20.53/month before taxes, excess backup, and egress, within the existing USD 75 resource-group budget.

### Deployment Proof — 2026-07-24

- Production workflow run `30122447628` completed successfully for merge commit `00e980399261f974cb4fbccc503afa676af1942f`, including the Key Vault preload, both Terraform applies, API image build, App Service deployment, and workflow smoke test.
- Azure Container Apps reports revision `nl-prod-convolens-api--0000024` ready and running image `nlprodconvolensacr.azurecr.io/convolens-api:00e980399261f974cb4fbccc503afa676af1942f`.
- App Service is running with normal availability, and both protected web settings are configured as Key Vault references.
- Independent checks returned HTTP 200 for the custom-domain home and features pages, `/api/runtime/auth-status` with `mystiraConfigured: true`, the production API `/health`, and `/api/extension/config`.
- The Mystira token-exchange route returned 400 for a missing token and 401 for an invalid token; the protected extension chat-export route returned 401 without authentication.
- The production extension archive was rebuilt and verified to contain the manifest, background/content bundles, popup, options UI, and CSS targeting the live API.
- Remaining acceptance step: an operator with a fresh Mystira session and a benign selected WhatsApp chat must click `Summarize` and confirm authenticated API receipt. This proves extraction and receipt only; persistence and AI summary generation remain TODO.

Production requirements:

- No hardcoded secrets.
- GitHub Actions uses OIDC, not long-lived Azure credentials.
- API uses managed identity to access Azure resources where possible.
- Web and API auth is through Mystira Identity.
- Key Vault purge protection enabled.
- Storage containers private.
- Uploaded chat exports treated as sensitive data.
- Define retention policy for raw WhatsApp exports, normalized messages, and summaries.
- Add data deletion path by user/export.
- Add audit trail for who imported, reviewed, and published Baton tasks.
- Add rate limits for upload and extension endpoints.
- Add file size and content validation already exists; expand with malware/content scanning decision if uploads become public-facing.
- Review WhatsApp terms and support posture before any automated WhatsApp Web monitoring.

## 8. CI/CD and Release Flow

Required pipelines:

- PR validation:
  - install dependencies;
  - lint;
  - typecheck;
  - unit tests;
  - API Docker build;
  - frontend build;
  - Terraform fmt/validate;
  - Terraform plan/what-if comment for prod.
- Main branch:
  - build and push API image;
  - deploy/provision infra after approval;
  - deploy API;
  - deploy frontend;
  - run smoke tests.
- Production environment:
  - protected GitHub environment;
  - required reviewers;
  - OIDC federated credential for `repo:neuralliquid/convolens:environment:prod`;
  - rollback instructions.

Recommended release gates:

- No open critical/high security findings.
- API image tested locally or in CI before deployment.
- Terraform plan reviewed.
- App health checks pass.
- One WhatsApp import smoke test passes.
- One Baton candidate publish smoke test passes.
- Logs/alerts verified.

## 9. Observability

Minimum dashboards and alerts:

- API availability and 5xx rate.
- API latency.
- Container App restarts.
- Queue depth and oldest message age.
- WhatsApp ingestion success/failure count.
- Baton publish success/failure count.
- Baton retry backlog.
- Database RU/throughput or PostgreSQL CPU/connections, depending on chosen database.
- Storage errors.
- Auth failures.
- Budget threshold alerts.

## 10. Go-Live Runbook

Preflight:

- Confirm subscription and tenant.
- Confirm target resource group naming.
- Confirm DNS names.
- Confirm `convolens.neuralliquid.ai` DNS ownership and target record type.
- Confirm GitHub OIDC prod credential.
- Confirm Mystira Identity client registration and redirect URIs.
- Confirm Baton project-routing rules and auth path.
- Confirm PostgreSQL as the first production database unless a concrete blocker appears.
- Confirm retention policy.
- Confirm admin email for budgets/alerts.

Build:

- Implement production data path.
- Implement WhatsApp-to-Baton intake slice.
- Add prod Terraform environment.
- Add CI/CD changes.
- Add runbook and smoke scripts.

Validation:

- Run unit and integration tests.
- Build frontend.
- Build API image.
- Run API image locally if Docker is available.
- Run Terraform fmt/validate.
- Run Terraform plan for prod.
- Run Azure deployment preview/what-if.
- Run security review on secrets and public endpoints.

Deployment:

- Provision/update prod infrastructure.
- Push API image.
- Deploy API.
- Deploy frontend.
- Configure DNS and CORS.
- Configure alerts.

Smoke:

- `GET /health/live` returns 200.
- `GET /health/ready` returns 200.
- Web app loads over production domain.
- Auth flow works through Mystira Identity.
- Chrome extension submits one known WhatsApp extraction.
- Upload one known WhatsApp export as fallback.
- Confirm raw artifact and normalized messages persisted.
- Confirm intake candidates are created.
- Publish one candidate to Baton.
- Confirm Baton task id is written back.
- Confirm failed Baton call retry path can be exercised without data loss.

Rollback:

- Keep previous API image tag.
- Use Container Apps revision rollback.
- Revert frontend deployment to previous build.
- Do not destroy production data resources during rollback.
- Pause Baton publishing if duplicate or bad candidate creation is detected.

## 11. Proposed Baton Work Packages

Baton tracker created on 2026-07-16 in the active Mystira project (`7ebf10db-5261-408a-9db2-8ba14d4110b7`). Continue to treat this plan as the delivery source of truth, and keep the Baton tracker synchronized as phases start and close.

Root task:

- Title: Convolens Mystira Azure production go-live
- Task id: `27d59d1e-0e0b-40e7-80de-fe1aba94de85`
- Project: active Mystira project unless a Convolens-specific Baton project is created later
- Priority: high

Child tasks:

- Phase 0 coordination baseline and approvals: `06658c74-a86e-4613-9a37-d9d4558b01a7`.
- Phase 1 production Azure foundation: `fccd0995-b045-42bc-baca-dc991060e4d8`.
- Phase 2 Mystira Identity auth and runtime shell: `a7004cd8-1097-4779-a22c-e8c1a686c0f7`.
- Phase 3 Postgres production data model: `0dea1455-4e56-40da-8d50-c77c6e102d18`.
- Phase 4 WhatsApp extension and manual intake persistence: `1b07ade8-409e-4384-ad3b-17f90513ff85`.
- Phase 5 candidate extraction and review UI: `4811f3fd-5759-43b4-9e26-52d0c8d6fe8e`.
- Phase 6 Baton publish integration with retry and idempotency: `725f1c46-cc0b-40da-bfd3-38a343ab0c46`.
- Phase 7 CI/CD and deployment readiness: `09443dfc-aa2f-4732-9e05-20c8119b09ac`.
- Phase 8 observability alerts and runbook: `788dc618-9060-41bf-a244-dfc0a2f91e8a`.
- Phase 9 serial go-live and handoff: `3d62321c-663b-44bf-954d-1e2dc9581ef2`.

## 12. Decisions and Recommendations

- Naming: use `nl-prod-convolens-*` in the Mystira subscription. This matches ownership and the user's corrected direction.
- Region: use `southafricanorth` wherever available. Use another region only for an explicitly unsupported service or capacity issue.
- Environment strategy: straight to `prod`; do not build a separate `dev` environment right now. Treat `prod` as the live working environment and keep deployment gates tight.
- Database: use PostgreSQL first. Reason: existing TypeORM entities/migrations map naturally to Postgres, and the go-live data model needs relational workflow state for ingestion, review, audit, and Baton publish records. Add Cosmos later only if message-document scale or query shape justifies it.
- Frontend hosting: use App Service for the Next.js web app unless a build spike proves Static Web Apps supports every runtime/auth requirement cleanly. App Service reduces risk for Mystira Identity callback/session behavior.
- Domain: use `convolens.neuralliquid.ai`.
- Auth: use Mystira Identity / Entra OIDC for web/operator access. Convolens should be a relying-party client, similar to the HOV/Sluice/Docket direction already used elsewhere.
- Baton project routing: route each intake to the relevant project. Default to the active Mystira project (`7ebf10db-5261-408a-9db2-8ba14d4110b7`) when classification is unclear; route obvious platform/service items to Sluice, Docket, Baton, Retort, HOV, Cognitive Mesh, etc. after a lookup.
- Baton publishing: review-gated at launch. Reason: WhatsApp extraction can overproduce noisy or ambiguous tasks, and wrong-project task creation creates durable cleanup work.
- Raw export retention: recommended default is 30 days for raw WhatsApp exports, 90 days for normalized extracted messages/candidates, and indefinite retention only for approved Baton task references/audit metadata. Add user/admin deletion support.
- Primary ingestion path: Chrome extension should be the go-live path because it can preserve structure and avoid manual export friction. Manual export upload stays as fallback and admin/debug path.
- Automated WhatsApp Web/Puppeteer monitoring: out of scope for initial production go-live. It has session, QR, browser automation, and WhatsApp policy risk. Revisit only after the extension/manual-import path is stable.

## 13. Approval Checkpoint

No implementation or deployment should happen until this plan is reviewed and approved.

After approval, the next step is to convert this plan into implementation work:

1. Create/reuse Baton root tracker and subtasks.
2. Create production Terraform environment.
3. Implement the production persistence and Baton intake slice.
4. Run Azure validation.
5. Deploy only after validation passes.

## 14. Phased Execution Plan

This work should run as coordinated phases with parallel lanes where dependencies allow it. The critical path is: production foundation -> data/auth readiness -> WhatsApp intake -> Baton publish -> validation -> go-live.

### Phase 0 - Coordination and Baseline

Goal: freeze the target shape and create durable coordination artifacts before implementation.

Inputs:

- Approved `.azure/plan.md`.
- Current repo state on the intended branch.
- Live Azure subscription context.
- Baton availability.

Work:

- Create or reuse a Baton root tracker for `Convolens Mystira Azure production go-live`.
- Create child tasks for infra, auth, data, frontend, API, extension, Baton integration, CI/CD, observability, and DNS.
- Confirm resource naming: `nl-prod-convolens-*`.
- Confirm target hostname: `convolens.neuralliquid.ai`.
- Confirm production-only delivery model: no separate dev environment for now.
- Confirm that `southafricanorth` is the default region.

Exit criteria:

- Baton tracker exists with work split into reviewable tasks.
- Implementation branch exists.
- Current worktree state is understood and unrelated local dirt is isolated.

Parallelism:

- Coordinator lane can create Baton tasks while infra/auth/data leads read code and prepare implementation notes.

### Phase 1 - Production Azure Foundation

Goal: create the production infrastructure plan without deploying application behavior yet.

Implementation note:

- The first Terraform profile is cost-minimized for internal evaluation: PostgreSQL, Redis, and dedicated ACR are disabled by default; the API scales to zero; frontend App Service uses the Free tier; storage uses LRS; telemetry is capped at 1 GB/day. The API target port defaults to `80` for the Azure helloworld placeholder image; set `api_target_port = 3001` when deploying the real API image. Flip `enable_postgres = true` and choose paid frontend/API sizing before treating the environment as durable production.

Work:

- Add `infra/terraform/env/prod`.
- Set `org = "nl"`, `env = "prod"`, `location = "southafricanorth"`.
- Add or wire:
  - `nl-prod-convolens-rg`;
  - Log Analytics;
  - Application Insights;
  - Key Vault with purge protection;
  - Storage account and private containers;
  - PostgreSQL Flexible Server or equivalent production Postgres service;
  - Container Apps API;
  - frontend App Service;
  - queue for ingestion/Baton publishing;
  - budget alerts;
  - managed identity role assignments;
  - outputs for URLs, identities, and telemetry.
- Decide whether to reuse shared ACR or create `nl-prod-convolens-acr`.
- Add DNS readiness notes for `convolens.neuralliquid.ai`.

Exit criteria:

- Terraform formats and validates.
- `terraform plan` is reviewed.
- No live deployment yet unless separately approved.

Parallelism:

- Infra lead owns Terraform.
- CI/CD lead can update workflow design in parallel once resource names are stable.
- Observability lead can define alert queries in parallel.

### Phase 2 - Auth and Runtime Shell

Goal: make Convolens production-authenticated through Mystira Identity and ready for the prod hostname.

Work:

- Register Convolens as a Mystira Identity OIDC relying party/client.
- Add app settings/env vars for:
  - issuer;
  - client id;
  - client secret reference;
  - callback/logout URLs;
  - session secret;
  - allowed origins.
- Wire Next.js auth flow for web/operator access.
- Protect import, review, publish, and admin routes.
- Update API auth validation if API receives identity tokens directly.
- Lock CORS to `https://convolens.neuralliquid.ai` and any required callback/dev-only temporary origins.

Exit criteria:

- Auth flow can be smoked locally or in a temporary environment.
- Protected routes fail closed.
- No auth secrets are committed.

Parallelism:

- Auth lead can work while infra lead builds Terraform.
- Frontend lead can wire UI route protection in parallel with API token validation.

### Phase 3 - Production Data Model

Goal: remove SQLite as the production dependency and persist all ingestion state durably.

Work:

- Add PostgreSQL driver/config and production connection handling.
- Update TypeORM config for Postgres in production.
- Define entities/tables for:
  - imports/extractions;
  - raw artifact metadata;
  - normalized chats;
  - normalized messages;
  - candidate tasks;
  - review decisions;
  - Baton publish attempts;
  - Baton task links;
  - audit events.
- Add migrations.
- Add idempotency keys/hashes for export and extension ingestion.
- Add deletion/retention fields.
- Add tests for duplicate extraction and persistence.

Exit criteria:

- API can start against Postgres.
- Migrations apply cleanly.
- Ingested data survives restart.
- Duplicate ingest does not duplicate candidates or Baton publishes.

Parallelism:

- Data lead owns schema/migrations.
- API intake lead can implement against repository interfaces once schemas are agreed.
- Retention/audit lead can write tests and policy docs in parallel.

### Phase 4 - WhatsApp Intake

Goal: make Chrome extension ingestion the primary go-live path, with manual export upload as fallback.

Work:

- Confirm Chrome extension production endpoint/config flow.
- Persist `/api/chat-export/extension` submissions.
- Persist `/api/chat-export/upload` fallback submissions.
- Store raw artifacts in Blob Storage.
- Store normalized messages in Postgres.
- Add ingestion queue job after persistence.
- Add selector-report persistence and admin access control.
- Add ingestion status APIs for review UI.
- Add smoke fixture for a known WhatsApp chat.

Exit criteria:

- Extension can submit a real extraction to the API.
- Manual upload works.
- Raw and normalized data are persisted.
- Ingestion status is visible.

Parallelism:

- Extension lead owns extension config and extraction submit flow.
- API intake lead owns endpoints/persistence.
- Storage lead owns Blob upload/download and managed identity access.

### Phase 5 - Candidate Extraction and Review

Goal: produce reviewable Baton task candidates from WhatsApp data without polluting Baton.

Work:

- Implement extraction pipeline from normalized messages to candidate actions.
- Add simple deterministic first pass before LLM dependence where possible:
  - explicit "todo/follow up/please" phrasing;
  - named owner/date;
  - project keywords;
  - decision/action markers.
- Add optional LLM summarization/extraction behind config and cost controls.
- Add candidate confidence and evidence spans.
- Add review UI/API:
  - accept;
  - edit;
  - reject;
  - choose target Baton project;
  - bulk publish selected.
- Add project recommendation rules:
  - default Mystira project;
  - Sluice/Docket/Baton/Retort/HOV/Cognitive Mesh keyword/project routing.

Exit criteria:

- Known fixture produces sensible candidates.
- Reviewer can edit and select target project.
- No task is created in Baton before approval.

Parallelism:

- Extraction lead owns candidate generation.
- Frontend lead owns review UI.
- Baton lead owns project lookup/routing rules.

### Phase 6 - Baton Publish Integration

Goal: publish reviewed candidates into the correct Baton projects with auditability and retries.

Work:

- Implement Baton client wrapper.
- Add task creation with:
  - title;
  - description;
  - priority;
  - context;
  - trace id;
  - triggeredBy;
  - source metadata.
- Add pre-publish duplicate check by source hash and normalized title.
- Add retry/backoff for Baton 502/timeouts.
- Persist publish attempts and results.
- Persist Baton task id and project id back to Convolens.
- Add admin retry action for `pending_baton` or `failed_baton`.

Exit criteria:

- One approved candidate creates one Baton task in the intended project.
- Duplicate publish is blocked.
- Baton outage does not lose candidates.
- Publish audit trail is visible.

Parallelism:

- Baton lead works after candidate schema is stable.
- API lead can implement retry worker in parallel with frontend publish controls.

### Phase 7 - CI/CD and Deployment Readiness

Goal: make the release repeatable and gated.

Work:

- Add production GitHub environment.
- Add OIDC federated credential for `repo:neuralliquid/convolens:environment:prod`.
- Build and push API image.
- Build frontend.
- Run test/lint/typecheck/build gates.
- Add Terraform fmt/validate/plan gate.
- Add production deployment workflow with manual approval.
- Add smoke test workflow:
  - health;
  - auth redirect;
  - API readiness;
  - extension config;
  - sample ingest;
  - Baton publish dry run or controlled real publish.

Exit criteria:

- CI passes.
- Deployment workflow is ready but not run without approval.
- Rollback procedure is documented.

Parallelism:

- CI/CD lead can start once infra names and app build requirements are known.
- QA lead can build smoke fixtures in parallel.

### Phase 8 - Observability and Runbook

Goal: make production operable before exposing it.

Work:

- Add dashboards/queries for:
  - API availability;
  - 5xx rate;
  - latency;
  - Container App restarts;
  - App Service health;
  - queue depth;
  - oldest queue message age;
  - ingestion failures;
  - Baton publish failures;
  - duplicate publish blocks;
  - auth failures;
  - DB health;
  - storage failures.
- Add alerts for critical conditions.
- Add go-live and rollback runbook.
- Add data retention/deletion runbook.

Exit criteria:

- Alerts exist.
- Runbook has concrete commands/URLs.
- Smoke evidence has a place to be recorded.

Parallelism:

- Observability lead can work after resource names and telemetry conventions are stable.
- Runbook lead can draft from Phase 1 onward and refine at each phase.

### Phase 9 - Go-Live

Goal: deploy, verify, and record the live state.

Work:

- Run final Terraform plan/preview.
- Apply approved infrastructure.
- Deploy API.
- Deploy frontend.
- Bind DNS for `convolens.neuralliquid.ai`.
- Configure CORS/callback URLs to final host.
- Run smoke tests:
  - web loads;
  - Mystira Identity login works;
  - API health works;
  - Chrome extension ingestion works;
  - manual upload works;
  - candidates are created;
  - one approved candidate publishes to Baton;
  - Baton task link is written back;
  - telemetry captures the flow.
- Record Baton closeout/handoff with:
  - URLs;
  - deployed revisions/images;
  - smoke results;
  - known limitations;
  - rollback steps.

Exit criteria:

- Production URL is usable.
- WhatsApp-to-Baton flow is verified.
- Baton handoff is recorded.
- No unresolved go-live blocker remains.

## 15. Parallel Agent Workstreams

Use concurrent subagents where the work is separable and each lane has clear inputs/outputs. Do not run parallel agents against the same files without coordination.

Recommended lanes:

- Coordinator/Baton agent:
  - create/reuse Baton tracker;
  - maintain phase status;
  - write closeout evidence;
  - avoid implementation files.
- Azure infra agent:
  - own Terraform prod environment;
  - own managed identity, Key Vault, storage, Postgres, Container Apps, App Service, budgets;
  - coordinate with CI/CD on resource names and outputs.
- Auth agent:
  - own Mystira Identity client requirements;
  - own web/API auth config;
  - coordinate redirect/CORS settings with infra and frontend.
- Data/API agent:
  - own Postgres migration from SQLite;
  - own persistence entities/repositories;
  - own ingestion status APIs.
- WhatsApp extension agent:
  - own extension endpoint config;
  - own extraction submit flow;
  - own extension smoke fixture.
- Baton integration agent:
  - own candidate-to-Baton publish API;
  - own project routing and duplicate detection;
  - own retry/pending states.
- Frontend/review UI agent:
  - own authenticated screens;
  - own import status and candidate review UI;
  - coordinate with API contracts.
- CI/CD agent:
  - own GitHub Actions, OIDC environment, image build, deployment, smoke workflows.
- Observability/QA agent:
  - own test matrix, smoke scripts, telemetry queries, alerts, runbook proof.

Concurrency rules:

- Phase 0 must complete before task creation spreads across lanes.
- Phase 1, Phase 2, and Phase 3 can run concurrently after decisions are locked, but shared config contracts must be reviewed daily.
- Phase 4 can start once the data repository interfaces are agreed; it does not need all infra to exist.
- Phase 5 can start with fixtures while Phase 4 persists real data.
- Phase 6 starts after candidate schema is stable.
- Phase 7 starts early but cannot finalize until infra outputs and app build paths are stable.
- Phase 8 starts early and follows resource naming/telemetry conventions.
- Phase 9 is serial and should be run by one coordinator with supporting agents on standby.
