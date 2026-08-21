variable "env" {
  type        = string
  description = "Environment name. Prod is intentionally the only supported value in this environment."
  default     = "prod"

  validation {
    condition     = var.env == "prod"
    error_message = "This Terraform environment only supports env = prod."
  }
}

variable "org" {
  type        = string
  description = "Organisation prefix per NL Azure naming standards."
  default     = "nl"

  validation {
    condition     = var.org == "nl"
    error_message = "The approved production prefix is nl."
  }
}

variable "projname" {
  type        = string
  description = "Project name used for resource naming."
  default     = "convolens"

  validation {
    condition     = var.projname == "convolens"
    error_message = "This production environment is scoped to convolens."
  }
}

variable "global_name_suffix" {
  type        = string
  description = "Optional lowercase suffix for globally unique resources during an isolated blue-green deployment. Empty preserves the live Mystira names."
  default     = ""

  validation {
    condition     = var.global_name_suffix == "" || can(regex("^[a-z0-9]{1,6}$", var.global_name_suffix))
    error_message = "global_name_suffix must be empty or 1-6 lowercase alphanumeric characters."
  }
}

variable "location" {
  type        = string
  description = "Primary Azure region for production resources."
  default     = "southafricanorth"
}

variable "database_name" {
  type        = string
  description = "PostgreSQL database name."
  default     = "convolens"
}

variable "postgres_admin_login" {
  type        = string
  description = "Administrator login for the legacy nl-prod-convolens-pg server. Retained for the rollback path only; the application no longer connects as this role."
  default     = "convolensadmin"
  sensitive   = true
}

# The application moved to the org-owned shared server on 2026-08-06. See
# neuralliquid-org/docs/adr/0002-shared-data-plane-ownership.md. The server is
# owned by neuralliquid-org Terraform; convolens owns its database, role and
# schema, and the settings below describe how to reach it.
variable "sluice_base_url" {
  type        = string
  description = "Sluice LiteLLM gateway used for governed AI requests."
  default     = "https://litellm.sluice.phoenixvc.tech"

  validation {
    condition     = startswith(var.sluice_base_url, "https://")
    error_message = "sluice_base_url must use HTTPS."
  }
}

variable "sluice_api_key" {
  type        = string
  description = <<-EOT
    Restricted ConvoLens Sluice virtual key. Empty by default, and that is the
    switch: with no key, no Sluice settings reach the container app and the
    application uses a direct provider, exactly as it does without this stack.

    Deliberately not a required variable. A required one with no default breaks
    every plan and apply until the value exists — see the api_jwt_secret failure
    fixed in #185 — and that cost is paid by everyone applying this stack, not
    just by whoever wants the gateway on.
  EOT
  sensitive   = true
  default     = ""
}

variable "enable_sluice" {
  type        = bool
  description = "Enable Sluice using an out-of-band Key Vault secret even when Terraform is not given the secret value."
  default     = false
}

variable "manage_runtime_secrets_with_terraform" {
  type        = bool
  description = "Legacy compatibility switch. New targets must keep this false so API JWT and Sluice values never enter Terraform state."
  default     = true
}

variable "sluice_api_key_secret_name" {
  type        = string
  description = "Key Vault secret name for the restricted ConvoLens Sluice virtual key."
  default     = "sluice-api-key"
}

variable "sluice_model" {
  type        = string
  description = "Sluice capability alias for grounded conversation catch-ups. A logical route, not a provider model name — Sluice resolves it."
  default     = "convolens-catch-up-v1"
}

variable "shared_postgres_fqdn" {
  type        = string
  description = "Host of the org-owned shared PostgreSQL server."
  default     = "nl-prod-shared-pg.postgres.database.azure.com"
}

variable "shared_postgres_username" {
  type        = string
  description = "Scoped login role that owns the convolens database. Not a server administrator, and holds no rights on any other tenant's objects."
  default     = "convolens"
}

variable "shared_postgres_database" {
  type        = string
  description = "Database name on the shared server."
  default     = "convolens"
}

variable "shared_postgres_password_secret_name" {
  type        = string
  description = "Key Vault secret holding the password for shared_postgres_username. Created out of band during the migration, so it is referenced by URI rather than managed here — Terraform never reads the value."
  default     = "shared-pg-convolens-password"
}

variable "postgres_sku_name" {
  type        = string
  description = "PostgreSQL Flexible Server SKU."
  default     = "B_Standard_B1ms"
}

variable "postgres_storage_mb" {
  type        = number
  description = "PostgreSQL storage size in MB."
  default     = 32768
}

variable "postgres_backup_retention_days" {
  type        = number
  description = "PostgreSQL backup retention period."
  default     = 7
}

variable "enable_postgres" {
  type        = bool
  description = "Provision PostgreSQL Flexible Server as the durable conversation source of truth."
  default     = false
}

variable "container_image_api" {
  type        = string
  description = "Container image for the API. The deployment pipeline should override the placeholder."
  default     = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
}

variable "api_target_port" {
  type        = number
  description = "Container App ingress target port for the Convolens API image."
  default     = 80
}

variable "api_jwt_secret" {
  type        = string
  description = "Legacy Terraform-managed JWT signing secret. New targets preload the secret out of band and leave this empty."
  sensitive   = true
  default     = ""

  validation {
    condition     = !var.manage_runtime_secrets_with_terraform || length(var.api_jwt_secret) >= 32
    error_message = "api_jwt_secret must be at least 32 characters when Terraform manages runtime secrets."
  }
}

variable "api_jwt_secret_name" {
  type        = string
  description = "Key Vault secret name for the API JWT signing secret."
  default     = "api-jwt-secret"
}

variable "deployment_principal_object_id" {
  type        = string
  description = "Optional object ID of the GitHub OIDC deployment principal. When set, grants permanent read access to deployment-managed Key Vault secrets."
  default     = ""
}

variable "frontend_runtime_stack" {
  type        = string
  description = "Linux App Service runtime stack for the Next.js frontend."
  default     = "24-lts"
}

variable "allowed_origin" {
  type        = string
  description = "Canonical production origin for CORS and browser callbacks."
  default     = "https://convolens.neuralliquid.ai"
}

variable "custom_hostname" {
  type        = string
  description = "Canonical production hostname. DNS binding is a go-live step after validation."
  default     = "convolens.neuralliquid.ai"
}

variable "mystira_identity_well_known" {
  type        = string
  description = "Mystira Identity OIDC discovery document URL."
  default     = "https://identity.mystira.app/.well-known/openid-configuration"
}

variable "mystira_identity_client_id" {
  type        = string
  description = "Mystira Identity OIDC client id for Convolens."
  default     = ""
}

variable "mystira_identity_scope" {
  type        = string
  description = "Mystira Identity OIDC scopes requested by Convolens."
  default     = "openid profile email offline_access"
}

variable "mystira_admin_emails" {
  type        = string
  description = "Comma-separated verified Mystira email identities allowed to administer Convolens. Empty denies all Mystira admin access."
  default     = ""
}

variable "mystira_admin_subjects" {
  type        = string
  description = "Comma-separated verified Mystira subject identifiers allowed to administer Convolens. Empty denies all subject-based admin access."
  default     = ""
}

variable "admin_email" {
  type        = string
  description = "Email address that receives budget alerts. Empty disables budget alerts."
  default     = ""
}

variable "monthly_budget_amount" {
  type        = number
  description = "Monthly resource-group budget in USD."
  default     = 75
}

variable "enable_budget_alerts" {
  type        = bool
  description = "Provision a resource-group-scoped consumption budget when admin_email is set."
  default     = true
}

variable "enable_container_registry" {
  type        = bool
  description = "Create a dedicated production Azure Container Registry for Convolens images."
  default     = true
}

variable "enable_redis" {
  type        = bool
  description = "Provision Azure Cache for Redis for distributed cache/session workloads."
  default     = false
}

variable "tags" {
  type        = map(string)
  description = "Additional tags merged with org/project/env defaults."
  default = {
    costCenter = "production"
  }
}
