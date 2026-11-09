# Root Terragrunt config: settings shared by every unit in both clouds.
# Cloud-specific remote state and providers live in <cloud>/cloud.hcl.
#
# Every unit is small and has its own state file, so a plan touches only
# what changed and a bad apply has a small blast radius.

locals {
  github_repository = "anthonyg820/reflexai-project"
}

generate "versions" {
  path      = "versions_override.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  required_version = ">= 1.10.0"
}
EOF
}
