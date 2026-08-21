# ConvoLens Production Runbook

## Overview

ConvoLens production is hosted in Azure. The web application runs in App
Service, the API runs in Azure Container Apps, and the production deployment is
executed by the `Deploy Production` GitHub Actions workflow.

Production deployment is intentionally approval-gated and manually dispatched.
Once approved, the workflow builds, applies the ConvoLens Terraform, deploys
the API image and web package, restarts the web app, and verifies the public
runtime.

## Production contract

| Component              | Endpoint                                                      |
| ---------------------- | ------------------------------------------------------------- |
| Web                    | `https://convolens.neuralliquid.ai`                           |
| Features               | `https://convolens.neuralliquid.ai/features`                  |
| Web auth configuration | `https://convolens.neuralliquid.ai/api/runtime/auth-status`   |
| API health             | `https://nl-prod-convolens-api.thankfulwave-56b90601.southafricanorth.azurecontainerapps.io/health` |
| API ready              | `https://nl-prod-convolens-api.thankfulwave-56b90601.southafricanorth.azurecontainerapps.io/ready` |
| OAuth callback         | `https://convolens.neuralliquid.ai/api/auth/callback/mystira` |

The auth configuration endpoint must return `{"mystiraConfigured":true}`.
It is intentionally under `/api/runtime`, not `/api/auth`, because NextAuth
handles the `/api/auth` namespace.

## Access prerequisites

- GitHub access to run the `Deploy Production` workflow and approve the
  `Production-NeuralLiquid` environment (live). The legacy `Production`
  environment still targets the stopped pre-migration stack.
- Azure access to subscription `5a95ddee-dd63-441a-8306-c8b0803dcdd4`
  (`neuralliquid-sub`) through the repository's OIDC deployment identity.
- Access to the GitHub environment variables `AZURE_CLIENT_ID`,
  `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, and `AZURE_OBJECT_ID` on
  `Production-NeuralLiquid`.
- Access to the required production secrets. Never print secret values in logs,
  issues, pull requests, or handoffs.

## Production deployment

1. Confirm the target commit has passed its normal CI checks.
2. In GitHub Actions, select `Deploy Production` and run it with
   `workflow_dispatch`, `deployment_environment=Production-NeuralLiquid`.
3. Approve the `Production-NeuralLiquid` environment when GitHub requests it.
4. Wait for the deployment job to complete. It builds the API and web app,
   applies `infra/terraform/env/prod`, pushes the API image to ACR, deploys the
   web package, restarts App Service, then executes public smoke tests.
5. Confirm the final workflow smoke step succeeds. A green build is not enough
   if the web, API, or semantic auth smoke fails.

The workflow provisions the Terraform backend if it is missing. Do not run an
ad hoc production Terraform apply outside the deployment workflow unless an
approved infrastructure change explicitly requires it.

## Post-deploy verification

Run these checks from a network with public access:

```powershell
curl.exe -fsS https://convolens.neuralliquid.ai/features
curl.exe -fsS https://convolens.neuralliquid.ai/api/runtime/auth-status
```

The features request must return HTTP 200 and the auth-status response must
contain `mystiraConfigured: true`. For sign-in verification, use the web login
button and confirm it navigates to Mystira Identity with the callback URL shown
above.

## WhatsApp browser integration

The current integration is an operator-assisted Chrome extension path:

1. Build the extension in `apps/chrome-extension`.
2. Open `chrome://extensions`, enable Developer mode, and choose Load unpacked.
3. Select the extracted extension ZIP root (the directory containing
   `manifest.json`) or the local built output according to the extension README.
4. In ConvoLens, open Dashboard -> Import -> WhatsApp Web and complete the
   import flow.

The extension targets the production API and dashboard through
`apps/chrome-extension/src/config.ts`. Successful `main` CI runs retain the
verified extension ZIP and SHA-256 checksum as a 30-day Actions artifact and
publish them to the immutable `extension-v<manifest version>` GitHub Release.
If the version already exists, CI compares extracted payloads and succeeds only
when they are identical; changed extension payloads require a version bump.
Chrome still requires extracting the ZIP and using **Load unpacked**; there is
no signed CRX, browser-store release, or unattended WhatsApp ingestion service
at present.

## Monitoring and diagnostics

- API readiness: request the Container Apps `/health` endpoint.
- API metrics: request `/metrics` only through an authorized operational path;
  it exposes process-local runtime metrics.
- Web startup or deployment failures: inspect the failed GitHub Actions run and
  the App Service logs.
- API startup or revision failures: inspect the Container App revision and its
  logs in Azure.
- Authentication failures: inspect the web auth-status endpoint first, then the
  Mystira Identity client callback and allowed origins. Do not log OAuth client
  secrets.

## Troubleshooting

### Web reports "Application Error" after deploy

The deployment workflow restarts App Service and retries the web smoke test to
cover package startup delay. If the issue persists, inspect the failed workflow
run and App Service logs, then restart the web app only after confirming the
deployed package and required app settings are present. Re-run the two public
verification checks after recovery.

### `/features` returns a generic 404

The route is implemented by `apps/web/src/app/features/page.tsx`. Verify that
the deployed commit contains the route, rerun the production workflow, and
check the public endpoint after App Service has started.

### Sign-in does not start or returns a provider error

Check `/api/runtime/auth-status`. If it does not report
`mystiraConfigured: true`, restore the required app settings and GitHub secrets
through the approved secret-management path. If it is configured, verify the
Mystira client callback and allowed CORS origin. The expected callback is the
production contract above.

### Deployment cannot log in to Azure

Confirm the Azure environment variables on `Production-NeuralLiquid` target
`neuralliquid-sub` and that the deployment identity has the GitHub
`Production-NeuralLiquid` federated credential. A disabled or stale
subscription credential produces `ReadOnlyDisabledSubscription`.

### Public hostname points at the old App Service

Live DNS for `convolens.neuralliquid.ai` is Cloudflare (not the Azure DNS
zone in `nl-global-shared-rg`). The CNAME must stay DNS-only (grey cloud)
and target `nl-prod-convolens-web-nl.azurewebsites.net`. Rollback is: point
that CNAME back to `nl-prod-convolens-web.azurewebsites.net` and start the
legacy web app and Container App in subscription
`bb4e3882-2079-4bab-8974-611bc0b8bb58`.

## Recovery boundaries

- Preserve the existing Mystira client secret when applying its Terraform.
- Keep operational diagnostics outside `/api/auth`.
- Do not claim the WhatsApp extension is store-installed or autonomous.
- Record production deploy run IDs and public smoke results in the release or
  handoff note.
