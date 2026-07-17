output "resource_group_name" {
  value       = azurerm_resource_group.rg.name
  description = "Resource group containing Convolens production resources."
}

output "key_vault_name" {
  value       = azurerm_key_vault.kv.name
  description = "Key Vault holding production secrets."
}

output "key_vault_uri" {
  value       = azurerm_key_vault.kv.vault_uri
  description = "Key Vault dataplane URI."
}

output "storage_account_name" {
  value       = azurerm_storage_account.st.name
  description = "Storage account for raw exports, artifacts, and queues."
}

output "storage_blob_endpoint" {
  value       = azurerm_storage_account.st.primary_blob_endpoint
  description = "Blob endpoint for production storage."
}

output "ingestion_queue_name" {
  value       = azurerm_storage_queue.ingestion.name
  description = "Queue for ingestion work."
}

output "baton_publish_queue_name" {
  value       = azurerm_storage_queue.baton_publish.name
  description = "Queue for Baton publish work."
}

output "postgres_server_fqdn" {
  value       = var.enable_postgres ? azurerm_postgresql_flexible_server.postgres[0].fqdn : ""
  description = "PostgreSQL Flexible Server FQDN."
}

output "postgres_database_name" {
  value       = var.enable_postgres ? azurerm_postgresql_flexible_server_database.app[0].name : ""
  description = "Application database name."
}

output "application_insights_connection_string" {
  value       = azurerm_application_insights.ai.connection_string
  description = "Application Insights connection string."
  sensitive   = true
}

output "container_app_url" {
  value       = "https://${azurerm_container_app.api.latest_revision_fqdn}"
  description = "Public URL of the API Container App."
}

output "frontend_default_hostname" {
  value       = "https://${azurerm_linux_web_app.frontend.default_hostname}"
  description = "Default App Service URL for the frontend before custom DNS binding."
}

output "custom_hostname" {
  value       = var.custom_hostname
  description = "Approved production hostname to bind during go-live."
}

output "container_registry_login_server" {
  value       = var.enable_container_registry ? azurerm_container_registry.acr[0].login_server : ""
  description = "Dedicated ACR login server, empty when ACR is disabled."
}
