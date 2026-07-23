param(
  [string]$Repo = "neuralliquid/convolens",
  [string]$AppId = "8f57a349-eb88-40fd-81eb-1065f84e668b",
  [string]$TenantId = "9530cd32-9e33-47f0-9247-ed964730b580",
  [string]$SubscriptionId = "bb4e3882-2079-4bab-8974-611bc0b8bb58"
)

$ErrorActionPreference = "Stop"

gh variable set AZURE_CLIENT_ID --repo $Repo --body $AppId
gh variable set AZURE_TENANT_ID --repo $Repo --body $TenantId
gh variable set AZURE_SUBSCRIPTION_ID --repo $Repo --body $SubscriptionId

$credentials = @(
  @{ name = "github-actions-dev"; subject = "repo:${Repo}:environment:dev" },
  @{ name = "github-actions-prod"; subject = "repo:${Repo}:environment:prod" },
  @{ name = "github-actions-production"; subject = "repo:${Repo}:environment:Production" }
)

foreach ($credential in $credentials) {
  $existing = az ad app federated-credential list --id $AppId `
    --query "[?name=='$($credential.name)'] | length(@)" `
    -o tsv

  if ($existing -eq "0") {
    $body = @{
      name = $credential.name
      issuer = "https://token.actions.githubusercontent.com"
      subject = $credential.subject
      audiences = @("api://AzureADTokenExchange")
    } | ConvertTo-Json -Compress

    $path = Join-Path $PSScriptRoot "$($credential.name).json"
    Set-Content -Path $path -Value $body
    az ad app federated-credential create --id $AppId --parameters $path
  }
}
