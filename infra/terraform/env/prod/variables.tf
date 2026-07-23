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
  description = "PostgreSQL administrator login. The password is generated and stored in Key Vault."
  default     = "convolensadmin"
  sensitive   = true
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
  description = "Provision PostgreSQL Flexible Server. Keep false for the internal eval apply to minimize recurring cost."
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
  default     = "openid profile email"
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
