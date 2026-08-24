data "azurerm_client_config" "current" {}

locals {
  prefix                   = "${var.org}-${var.env}-${var.projname}"
  alphanumeric             = lower(replace(local.prefix, "-", ""))
  hyphenated_global_suffix = var.global_name_suffix == "" ? "" : "-${var.global_name_suffix}"
  is_blue_green_target     = var.global_name_suffix != ""

  rg_name              = "${local.prefix}-rg"
  law_name             = "${local.prefix}-law"
  ai_name              = "${local.prefix}-appi"
  storage_name         = substr("${local.alphanumeric}${var.global_name_suffix}st", 0, 24)
  kv_name              = substr("${local.prefix}${local.hyphenated_global_suffix}-kv", 0, 24)
  postgres_name        = "${local.prefix}-pg"
  cae_name             = "${local.prefix}-cae"
  api_name             = "${local.prefix}-api"
  service_plan_name    = "${local.prefix}-asp"
  frontend_name        = "${local.prefix}-web${local.hyphenated_global_suffix}"
  acr_name             = substr("${local.alphanumeric}${var.global_name_suffix}acr", 0, 50)
  redis_name           = "${local.prefix}-redis"
  ingestion_queue_name = "ingestion"
  publish_queue_name   = "baton-publish"

  # Legacy targets infer enablement from the Terraform-supplied key. New targets
  # explicitly enable Sluice while referencing a value preloaded into Key Vault,
  # keeping the secret out of Terraform plans and state.
  sluice_enabled = var.enable_sluice || trimspace(var.sluice_api_key) != ""

  tags = merge(
    {
      org         = var.org
      project     = var.projname
      environment = var.env
      managedBy   = "terraform"
    },
    var.tags,
  )

  blob_containers = [
    "chat-exports",
    "raw-artifacts",
    "normalized-artifacts",
    "review-exports",
  ]
}

resource "azurerm_resource_group" "rg" {
  name     = local.rg_name
  location = var.location
  tags     = local.tags
}

resource "azurerm_log_analytics_workspace" "law" {
  name                = local.law_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  daily_quota_gb      = 1
  tags                = local.tags
}

resource "azurerm_application_insights" "ai" {
  name                 = local.ai_name
  location             = azurerm_resource_group.rg.location
  resource_group_name  = azurerm_resource_group.rg.name
  workspace_id         = azurerm_log_analytics_workspace.law.id
  application_type     = "web"
  retention_in_days    = 30
  daily_data_cap_in_gb = 1
  tags                 = local.tags
}

resource "azurerm_key_vault" "kv" {
  name                          = local.kv_name
  location                      = azurerm_resource_group.rg.location
  resource_group_name           = azurerm_resource_group.rg.name
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  purge_protection_enabled      = true
  soft_delete_retention_days    = 90
  rbac_authorization_enabled    = true
  public_network_access_enabled = true
  tags                          = local.tags

  network_acls {
    bypass         = "AzureServices"
    default_action = "Allow"
  }
}

resource "azurerm_user_assigned_identity" "api" {
  count               = local.is_blue_green_target ? 1 : 0
  name                = "${local.prefix}${local.hyphenated_global_suffix}-api-id"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = local.tags
}

resource "azurerm_storage_account" "st" {
  name                            = local.storage_name
  location                        = azurerm_resource_group.rg.location
  resource_group_name             = azurerm_resource_group.rg.name
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  account_kind                    = "StorageV2"
  access_tier                     = "Hot"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false
  tags                            = local.tags

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 7
    }

    container_delete_retention_policy {
      days = 7
    }
  }

}

resource "azurerm_storage_account_queue_properties" "queue" {
  storage_account_id = azurerm_storage_account.st.id

  logging {
    delete                = true
    read                  = true
    write                 = true
    version               = "1.0"
    retention_policy_days = 30
  }
}

resource "azurerm_storage_container" "containers" {
  for_each              = toset(local.blob_containers)
  name                  = each.value
  storage_account_id    = azurerm_storage_account.st.id
  container_access_type = "private"
}

resource "azurerm_storage_queue" "ingestion" {
  name               = local.ingestion_queue_name
  storage_account_id = azurerm_storage_account.st.id
}

resource "azurerm_storage_queue" "baton_publish" {
  name               = local.publish_queue_name
  storage_account_id = azurerm_storage_account.st.id
}

resource "random_password" "postgres_admin" {
  # Preserve the already-managed legacy value when the suffix is empty, while
  # avoiding a new unused credential in blue-green targets that reuse the
  # shared PostgreSQL server.
  count            = var.enable_postgres || var.global_name_suffix == "" ? 1 : 0
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "azurerm_postgresql_flexible_server" "postgres" {
  count                         = var.enable_postgres ? 1 : 0
  name                          = local.postgres_name
  location                      = azurerm_resource_group.rg.location
  resource_group_name           = azurerm_resource_group.rg.name
  version                       = "16"
  administrator_login           = var.postgres_admin_login
  administrator_password        = random_password.postgres_admin[0].result
  sku_name                      = var.postgres_sku_name
  storage_mb                    = var.postgres_storage_mb
  backup_retention_days         = var.postgres_backup_retention_days
  public_network_access_enabled = true
  zone                          = "1"
  tags                          = local.tags
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  count     = var.enable_postgres ? 1 : 0
  name      = var.database_name
  server_id = azurerm_postgresql_flexible_server.postgres[0].id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  count            = var.enable_postgres ? 1 : 0
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.postgres[0].id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_key_vault_secret" "postgres_password" {
  count        = var.enable_postgres ? 1 : 0
  name         = "postgres-admin-password"
  value        = random_password.postgres_admin[0].result
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "appinsights_connection_string" {
  count        = local.is_blue_green_target ? 0 : 1
  name         = "appinsights-connection-string"
  value        = azurerm_application_insights.ai.connection_string
  key_vault_id = azurerm_key_vault.kv.id
}

# The container app resolves jwt-secret from the vault rather than holding the
# literal, so this needs to exist there. The value still originates from CI
# (TF_VAR_api_jwt_secret) — the vault becomes the distribution point, not a new
# source of truth.
# Sluice is the only path on which this service's AI spend is attributable, so
# the application prefers it (apps/api/src/services/ai/*). It selects Sluice only
# when both SLUICE_BASE_URL and SLUICE_API_KEY are present, which is why all
# three settings below are gated together: a half-configured gateway would leave
# the app silently on a direct provider while looking configured.
resource "azurerm_key_vault_secret" "sluice_api_key" {
  count        = var.manage_runtime_secrets_with_terraform && local.sluice_enabled ? 1 : 0
  name         = var.sluice_api_key_secret_name
  value        = var.sluice_api_key
  key_vault_id = azurerm_key_vault.kv.id
}

moved {
  from = random_password.postgres_admin
  to   = random_password.postgres_admin[0]
}

moved {
  from = azurerm_key_vault_secret.appinsights_connection_string
  to   = azurerm_key_vault_secret.appinsights_connection_string[0]
}

moved {
  from = azurerm_key_vault_secret.api_jwt_secret
  to   = azurerm_key_vault_secret.api_jwt_secret[0]
}

moved {
  from = azurerm_role_assignment.api_blob_contributor
  to   = azurerm_role_assignment.api_blob_contributor[0]
}

moved {
  from = azurerm_role_assignment.api_queue_contributor
  to   = azurerm_role_assignment.api_queue_contributor[0]
}

moved {
  from = azurerm_role_assignment.api_key_vault_secrets_user
  to   = azurerm_role_assignment.api_key_vault_secrets_user[0]
}

resource "azurerm_key_vault_secret" "api_jwt_secret" {
  count        = var.manage_runtime_secrets_with_terraform ? 1 : 0
  name         = var.api_jwt_secret_name
  value        = var.api_jwt_secret
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_container_registry" "acr" {
  count                         = var.enable_container_registry ? 1 : 0
  name                          = local.acr_name
  location                      = azurerm_resource_group.rg.location
  resource_group_name           = azurerm_resource_group.rg.name
  sku                           = "Basic"
  admin_enabled                 = !local.is_blue_green_target
  anonymous_pull_enabled        = false
  public_network_access_enabled = true
  tags                          = local.tags
}

resource "azurerm_container_app_environment" "cae" {
  name                       = local.cae_name
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id
  tags                       = local.tags
}

resource "azurerm_container_app" "api" {
  name                         = local.api_name
  container_app_environment_id = azurerm_container_app_environment.cae.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"
  tags                         = local.tags

  identity {
    type         = local.is_blue_green_target ? "UserAssigned" : "SystemAssigned"
    identity_ids = local.is_blue_green_target ? [terraform_data.api_identity_ready[0].output] : []
  }

  # Secrets are Key Vault references, not literals. The vault is the single place
  # a value is rotated; previously the same secret lived both here and in the
  # vault, so rotation meant changing it twice and the vault was authoritative
  # for nothing. Resolution uses the system-assigned identity, which already
  # holds Key Vault Secrets User via azurerm_role_assignment.api_key_vault_secrets_user.
  secret {
    name                = "appinsights-connection-string"
    value               = local.is_blue_green_target ? azurerm_application_insights.ai.connection_string : null
    key_vault_secret_id = local.is_blue_green_target ? null : azurerm_key_vault_secret.appinsights_connection_string[0].versionless_id
    identity            = local.is_blue_green_target ? null : "System"
  }

  dynamic "secret" {
    for_each = local.sluice_enabled ? [1] : []

    content {
      name                = "sluice-api-key"
      key_vault_secret_id = var.manage_runtime_secrets_with_terraform ? azurerm_key_vault_secret.sluice_api_key[0].versionless_id : "${azurerm_key_vault.kv.vault_uri}secrets/${var.sluice_api_key_secret_name}"
      identity            = local.is_blue_green_target ? terraform_data.api_identity_ready[0].output : "System"
    }
  }

  # The scoped role's password on the shared server. This secret was created out
  # of band during the migration, so it is referenced by URI: managing it here
  # would mean Terraform holding the value in state to no benefit.
  secret {
    name                = "db-password"
    key_vault_secret_id = "${azurerm_key_vault.kv.vault_uri}secrets/${var.shared_postgres_password_secret_name}"
    identity            = local.is_blue_green_target ? terraform_data.api_identity_ready[0].output : "System"
  }

  secret {
    name                = "jwt-secret"
    key_vault_secret_id = var.manage_runtime_secrets_with_terraform ? azurerm_key_vault_secret.api_jwt_secret[0].versionless_id : "${azurerm_key_vault.kv.vault_uri}secrets/${var.api_jwt_secret_name}"
    identity            = local.is_blue_green_target ? terraform_data.api_identity_ready[0].output : "System"
  }

  dynamic "secret" {
    for_each = var.enable_container_registry && !local.is_blue_green_target ? [azurerm_container_registry.acr[0]] : []

    content {
      name  = "acr-password"
      value = secret.value.admin_password
    }
  }

  dynamic "registry" {
    for_each = var.enable_container_registry && !local.is_blue_green_target ? [azurerm_container_registry.acr[0]] : []

    content {
      server               = registry.value.login_server
      username             = registry.value.admin_username
      password_secret_name = "acr-password"
    }
  }

  dynamic "registry" {
    for_each = var.enable_container_registry && local.is_blue_green_target ? [azurerm_container_registry.acr[0]] : []

    content {
      server   = registry.value.login_server
      identity = terraform_data.api_identity_ready[0].output
    }
  }

  ingress {
    external_enabled = true
    target_port      = var.api_target_port
    transport        = "http"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }

    cors {
      allowed_origins = [var.allowed_origin]
      allowed_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
      allowed_headers = ["content-type", "authorization", "x-correlation-id", "x-idempotency-key"]
      exposed_headers = []
    }
  }

  template {
    min_replicas = 0
    max_replicas = 2

    container {
      name    = "api"
      image   = var.container_image_api
      cpu     = 0.5
      memory  = "1Gi"
      args    = []
      command = []

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name        = "JWT_SECRET"
        secret_name = "jwt-secret"
      }
      env {
        name  = "PORT"
        value = tostring(var.api_target_port)
      }
      env {
        name  = "FRONTEND_URL"
        value = var.allowed_origin
      }
      env {
        name  = "CORS_ORIGIN"
        value = var.allowed_origin
      }
      env {
        name  = "MYSTIRA_IDENTITY_WELL_KNOWN"
        value = var.mystira_identity_well_known
      }
      env {
        name  = "MYSTIRA_IDENTITY_CLIENT_ID"
        value = var.mystira_identity_client_id
      }
      env {
        name  = "MYSTIRA_ADMIN_EMAILS"
        value = var.mystira_admin_emails
      }
      env {
        name  = "MYSTIRA_ADMIN_SUBJECTS"
        value = var.mystira_admin_subjects
      }
      env {
        name  = "DB_TYPE"
        value = "postgres"
      }
      # The shared server, not azurerm_postgresql_flexible_server.postgres. That
      # resource is the pre-migration server and is retained only as the rollback
      # path; pointing the app back at it would undo the 2026-08-06 migration and
      # reconnect as a server administrator.
      env {
        name  = "DB_HOST"
        value = var.shared_postgres_fqdn
      }
      env {
        name  = "DB_PORT"
        value = "5432"
      }
      env {
        name  = "DB_USERNAME"
        value = var.shared_postgres_username
      }
      env {
        name        = "DB_PASSWORD"
        secret_name = "db-password"
      }
      env {
        name  = "DB_NAME"
        value = var.shared_postgres_database
      }
      env {
        name  = "DB_SSL"
        value = "true"
      }
      env {
        name  = "DB_MIGRATIONS_RUN"
        value = "true"
      }
      env {
        name  = "DATABASE_PATH"
        value = "/tmp/convolens-eval.sqlite"
      }
      env {
        name        = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        secret_name = "appinsights-connection-string"
      }
      env {
        name        = "AZURE_APP_INSIGHTS_CONNECTION_STRING"
        secret_name = "appinsights-connection-string"
      }
      env {
        name  = "AZURE_STORAGE_ACCOUNT_NAME"
        value = azurerm_storage_account.st.name
      }
      env {
        name  = "AZURE_PROVIDER_ENABLED"
        value = "true"
      }

      # Container Apps' identity sidecar has no implicit default identity — a
      # UserAssigned-only container must pass client_id on every token request or
      # every request fails with "Unable to load the proper Managed Identity.",
      # even with exactly one identity attached. Not needed on the legacy
      # SystemAssigned path (identity type set at line 294).
      dynamic "env" {
        for_each = local.is_blue_green_target ? [1] : []

        content {
          name  = "AZURE_STORAGE_IDENTITY_CLIENT_ID"
          value = azurerm_user_assigned_identity.api[0].client_id
        }
      }

      # All three or none — see local.sluice_enabled.
      dynamic "env" {
        for_each = local.sluice_enabled ? [1] : []

        content {
          name  = "SLUICE_BASE_URL"
          value = var.sluice_base_url
        }
      }

      dynamic "env" {
        for_each = local.sluice_enabled ? [1] : []

        content {
          name        = "SLUICE_API_KEY"
          secret_name = "sluice-api-key"
        }
      }

      dynamic "env" {
        for_each = local.sluice_enabled ? [1] : []

        content {
          name  = "SLUICE_MODEL"
          value = var.sluice_model
        }
      }

      env {
        name  = "BATON_BASE_URL"
        value = "https://baton-backend.up.railway.app"
      }
      env {
        name  = "BATON_WEB_BASE_URL"
        value = "https://baton.phoenixvc.tech"
      }
      env {
        name  = "BATON_DEFAULT_PROJECT_ID"
        value = "d20d739a-89b0-4a48-8f9b-dcb0724c149d"
      }
      env {
        name  = "AZURE_STORAGE_CONTAINER"
        value = "chat-exports"
      }
      env {
        name  = "AZURE_STORAGE_INGESTION_QUEUE"
        value = azurerm_storage_queue.ingestion.name
      }
      env {
        name  = "AZURE_STORAGE_BATON_PUBLISH_QUEUE"
        value = azurerm_storage_queue.baton_publish.name
      }
      env {
        name  = "AZURE_KEY_VAULT_NAME"
        value = azurerm_key_vault.kv.name
      }

      startup_probe {
        transport               = "HTTP"
        port                    = var.api_target_port
        path                    = "/health"
        interval_seconds        = 10
        timeout                 = 5
        failure_count_threshold = 30
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = var.api_target_port
        path                    = "/ready"
        interval_seconds        = 10
        timeout                 = 5
        failure_count_threshold = 6
      }
    }

    http_scale_rule {
      name                = "http-rule"
      concurrent_requests = "100"
    }
  }
}

resource "azurerm_service_plan" "frontend" {
  name                = local.service_plan_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  os_type             = "Linux"
  # B1 is the lowest App Service tier that supports managed certificates for custom domains.
  sku_name = "B1"
  tags     = local.tags
}

resource "azurerm_linux_web_app" "frontend" {
  name                = local.frontend_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  service_plan_id     = azurerm_service_plan.frontend.id
  https_only          = true
  tags                = local.tags

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on        = false
    app_command_line = "cd apps/web && node server.js"

    application_stack {
      node_version = var.frontend_runtime_stack
    }
  }

  app_settings = merge({
    NODE_ENV                              = "production"
    NEXT_PUBLIC_API_URL                   = "https://${azurerm_container_app.api.ingress[0].fqdn}/api"
    NEXT_PUBLIC_API_BASE_URL              = "https://${azurerm_container_app.api.ingress[0].fqdn}"
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.ai.connection_string
    AZURE_APP_INSIGHTS_CONNECTION_STRING  = azurerm_application_insights.ai.connection_string
    NEXTAUTH_URL                          = var.allowed_origin
    NEXTAUTH_SECRET                       = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.kv.name};SecretName=nextauth-secret)"
    MYSTIRA_IDENTITY_WELL_KNOWN           = var.mystira_identity_well_known
    MYSTIRA_IDENTITY_SCOPE                = var.mystira_identity_scope
    MYSTIRA_IDENTITY_CLIENT_SECRET        = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.kv.name};SecretName=mystira-identity-client-secret)"
    SCM_DO_BUILD_DURING_DEPLOYMENT        = "false"
    WEBSITE_RUN_FROM_PACKAGE              = "1"
    CONVOLENS_CANONICAL_HOSTNAME          = var.custom_hostname
    }, var.mystira_identity_client_id != "" ? {
    MYSTIRA_IDENTITY_CLIENT_ID = var.mystira_identity_client_id
  } : {})
}

resource "azurerm_redis_cache" "redis" {
  count                         = var.enable_redis ? 1 : 0
  name                          = local.redis_name
  location                      = azurerm_resource_group.rg.location
  resource_group_name           = azurerm_resource_group.rg.name
  capacity                      = 1
  family                        = "C"
  sku_name                      = "Standard"
  minimum_tls_version           = "1.2"
  public_network_access_enabled = true
  tags                          = local.tags
}

resource "azurerm_role_assignment" "api_blob_contributor" {
  count                = local.is_blue_green_target ? 0 : 1
  scope                = azurerm_storage_account.st.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_container_app.api.identity[0].principal_id
}

resource "azurerm_role_assignment" "api_queue_contributor" {
  count                = local.is_blue_green_target ? 0 : 1
  scope                = azurerm_storage_account.st.id
  role_definition_name = "Storage Queue Data Contributor"
  principal_id         = azurerm_container_app.api.identity[0].principal_id
}

resource "azurerm_role_assignment" "api_key_vault_secrets_user" {
  count                = local.is_blue_green_target ? 0 : 1
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_container_app.api.identity[0].principal_id
}

resource "azurerm_role_assignment" "frontend_key_vault_secrets_user" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.frontend.identity[0].principal_id
}

resource "azurerm_role_assignment" "blue_green_api_blob_contributor" {
  count                = local.is_blue_green_target ? 1 : 0
  scope                = azurerm_storage_account.st.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.api[0].principal_id
}

resource "azurerm_role_assignment" "blue_green_api_queue_contributor" {
  count                = local.is_blue_green_target ? 1 : 0
  scope                = azurerm_storage_account.st.id
  role_definition_name = "Storage Queue Data Contributor"
  principal_id         = azurerm_user_assigned_identity.api[0].principal_id
}

resource "azurerm_role_assignment" "blue_green_api_key_vault_secrets_user" {
  count                = local.is_blue_green_target ? 1 : 0
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.api[0].principal_id
}

resource "azurerm_role_assignment" "blue_green_api_acr_pull" {
  count                = local.is_blue_green_target && var.enable_container_registry ? 1 : 0
  scope                = azurerm_container_registry.acr[0].id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.api[0].principal_id
}

resource "time_sleep" "blue_green_api_rbac_propagation" {
  count           = local.is_blue_green_target ? 1 : 0
  create_duration = "5m"

  triggers = {
    blob_role_assignment_id      = azurerm_role_assignment.blue_green_api_blob_contributor[0].id
    queue_role_assignment_id     = azurerm_role_assignment.blue_green_api_queue_contributor[0].id
    key_vault_role_assignment_id = azurerm_role_assignment.blue_green_api_key_vault_secrets_user[0].id
    acr_role_assignment_id       = try(azurerm_role_assignment.blue_green_api_acr_pull[0].id, "")
  }
}

resource "terraform_data" "api_identity_ready" {
  count = local.is_blue_green_target ? 1 : 0
  input = azurerm_user_assigned_identity.api[0].id

  depends_on = [
    time_sleep.blue_green_api_rbac_propagation,
  ]
}

resource "azurerm_role_assignment" "deployment_key_vault_secrets_user" {
  count                = var.deployment_principal_object_id == "" ? 0 : 1
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = var.deployment_principal_object_id
}

resource "azurerm_consumption_budget_resource_group" "budget" {
  count             = var.enable_budget_alerts && var.admin_email != "" ? 1 : 0
  name              = "${local.prefix}-budget"
  resource_group_id = azurerm_resource_group.rg.id
  amount            = var.monthly_budget_amount
  time_grain        = "Monthly"

  time_period {
    start_date = formatdate("YYYY-MM-01'T'00:00:00'Z'", timestamp())
  }

  notification {
    enabled        = true
    operator       = "GreaterThan"
    threshold      = 80
    threshold_type = "Actual"
    contact_emails = [var.admin_email]
  }

  notification {
    enabled        = true
    operator       = "GreaterThan"
    threshold      = 100
    threshold_type = "Forecasted"
    contact_emails = [var.admin_email]
  }

  lifecycle {
    ignore_changes = [time_period]
  }
}
