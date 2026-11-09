# Shared definition for aws/<env>/cluster.
locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  env      = local.env_vars.env
  name     = "rehearse-${local.env}"
}

terraform {
  source = "${get_repo_root()}/infra/modules//aws-ecs-cluster"
}

dependency "secrets" {
  config_path = "${get_terragrunt_dir()}/../secrets"
  mock_outputs = {
    path_prefix = "/rehearse/mock/"
  }
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
}

inputs = {
  name            = local.name
  ssm_path_prefix = dependency.secrets.outputs.path_prefix
}
