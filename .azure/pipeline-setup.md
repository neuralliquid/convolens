# Convolens Pipeline Auth Setup

Convolens production CI/CD uses GitHub Actions OIDC against the existing Entra app registration `convolens-sp`.

## Current Target

- GitHub repo: `neuralliquid/convolens`
- Azure tenant: `9530cd32-9e33-47f0-9247-ed964730b580`
- Azure subscription: `bb4e3882-2079-4bab-8974-611bc0b8bb58`
- Entra app/client id: `8f57a349-eb88-40fd-81eb-1065f84e668b`
- Service principal object id: `d487629d-0758-4192-bf00-dfd4f214a738`

## Required GitHub Variables

Set these as repository variables:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

The values are non-secret identifiers. Do not use the stale `AZURE_CREDENTIALS` secret for deployment.

## Required Federated Credentials

The Entra app registration needs GitHub OIDC federated credentials for each GitHub environment used by deployment workflows:

- `repo:neuralliquid/convolens:environment:dev`
- `repo:neuralliquid/convolens:environment:prod`
- `repo:neuralliquid/convolens:environment:Production`

`prod` is used by the infrastructure workflow. `Production` is retained for the production deploy workflow while that GitHub environment exists.

## Required RBAC

The service principal must have deployment rights on the target subscription or narrowed resource groups. Current recovery uses `Contributor` on the Mystira subscription so Terraform can create/update the production resource group, state storage, ACR, Container App, and App Service resources.

## Verification

Before running production deploy:

1. Confirm the GitHub variables exist with `gh variable list --repo neuralliquid/convolens`.
2. Confirm federated credentials with `az ad app federated-credential list --id 8f57a349-eb88-40fd-81eb-1065f84e668b`.
3. Run the infrastructure workflow with `environment=prod` and `action=plan`.
4. Run production deploy only after the plan is reviewed.
