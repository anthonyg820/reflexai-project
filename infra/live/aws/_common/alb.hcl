# Shared definition for aws/<env>/alb.
locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  env      = local.env_vars.env
  name     = "rehearse-${local.env}"
}

terraform {
  source = "${get_repo_root()}/infra/modules//aws-alb"
}

dependency "network" {
  config_path = "${get_terragrunt_dir()}/../../shared/network"
  mock_outputs = {
    vpc_id            = "vpc-mock"
    public_subnet_ids = ["subnet-mock-a", "subnet-mock-b"]
  }
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
}

inputs = {
  name       = local.name
  vpc_id     = dependency.network.outputs.vpc_id
  subnet_ids = dependency.network.outputs.public_subnet_ids
}
