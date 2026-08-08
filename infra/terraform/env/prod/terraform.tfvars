env      = "prod"
org      = "nl"
projname = "convolens"
location = "southafricanorth"

database_name = "convolens"

allowed_origin  = "https://convolens.neuralliquid.ai"
custom_hostname = "convolens.neuralliquid.ai"

enable_budget_alerts      = true
enable_container_registry = true
# The pre-migration server. Convolens moved to the org-owned nl-prod-shared-pg on
# 2026-08-06 and has run there since; this stack no longer provisions a database
# for the application, it only described the server that was left behind as a
# rollback path. Setting this false destroys nl-prod-convolens-pg, its database,
# its firewall rule and the old admin secret. There is no soft delete for a
# flexible server, so this is the point of no return for that rollback.
enable_postgres = false
enable_redis    = false

admin_email           = ""
monthly_budget_amount = 75

container_image_api = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
api_target_port     = 3001

tags = {
  costCenter = "production"
}
