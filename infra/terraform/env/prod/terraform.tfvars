env      = "prod"
org      = "nl"
projname = "convolens"
location = "southafricanorth"

database_name = "convolens"

allowed_origin  = "https://convolens.neuralliquid.ai"
custom_hostname = "convolens.neuralliquid.ai"

enable_budget_alerts      = true
enable_container_registry = true
# ConvoLens now uses the org-owned nl-prod-data-pg server in neuralliquid-sub;
# this stack no longer provisions a database for the application. Setting this
# false destroys nl-prod-convolens-pg, its database, its firewall rule and the
# old admin secret. This removes the product-local Terraform rollback path;
# Azure may restore a deleted Flexible Server only within five days.
enable_postgres = false
enable_redis    = false

admin_email           = ""
monthly_budget_amount = 75

container_image_api = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
api_target_port     = 3001

tags = {
  costCenter = "production"
}
