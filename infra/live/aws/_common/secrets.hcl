# Shared definition for aws/<env>/secrets.
locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  env      = local.env_vars.env
  name     = "rehearse-${local.env}"
}

terraform {
  source = "${get_repo_root()}/infra/modules//aws-ssm-secrets"
}

inputs = {
  env = local.env
}
