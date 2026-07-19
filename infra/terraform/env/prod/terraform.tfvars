env      = "prod"
org      = "nl"
projname = "convolens"
location = "southafricanorth"

database_name = "convolens"

allowed_origin  = "https://convolens.neuralliquid.ai"
custom_hostname = "convolens.neuralliquid.ai"

enable_budget_alerts      = true
enable_container_registry = true
enable_postgres           = false
enable_redis              = false

admin_email           = ""
monthly_budget_amount = 75

container_image_api = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
api_target_port     = 3001

tags = {
  costCenter = "production"
}
