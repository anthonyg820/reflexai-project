# GCP settings for every unit under infra/live/gcp.
# Set GCP_PROJECT_ID (and optionally GCP_REGION) in your shell or CI.
locals {
  project_id = get_env("GCP_PROJECT_ID")
  region     = get_env("GCP_REGION", "us-east1")
}

remote_state {
  backend = "gcs"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    project  = local.project_id
    location = "us"
    bucket   = "${local.project_id}-tfstate"
    prefix   = "gcp/${path_relative_to_include()}"
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "google" {
  project = "${local.project_id}"
  region  = "${local.region}"
  default_labels = {
    app        = "rehearse"
    managed-by = "terragrunt"
  }
}
EOF
}
