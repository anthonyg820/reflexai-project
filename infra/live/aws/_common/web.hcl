# Shared definition for aws/<env>/web: the ECS service shell.
locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  env      = local.env_vars.env
  name     = "rehearse-${local.env}"
}

terraform {
  source = "${get_repo_root()}/infra/modules//aws-ecs-service"
}

dependency "network" {
  config_path = "${get_terragrunt_dir()}/../../shared/network"
  mock_outputs = {
    vpc_id            = "vpc-mock"
    public_subnet_ids = ["subnet-mock-a", "subnet-mock-b"]
  }
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
}

dependency "alb" {
  config_path = "${get_terragrunt_dir()}/../alb"
  mock_outputs = {
    security_group_id = "sg-mock"
    target_group_arns = {
      web = "arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/mock-web/0000000000000000"
      api = "arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/mock-api/0000000000000000"
    }
  }
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
}

dependency "cluster" {
  config_path = "${get_terragrunt_dir()}/../cluster"
  mock_outputs = {
    cluster_arn        = "arn:aws:ecs:us-east-1:000000000000:cluster/mock"
    execution_role_arn = "arn:aws:iam::000000000000:role/mock-ecs-exec"
  }
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
}

inputs = {
  name                  = "${local.name}-web"
  container_name        = "web"
  cluster_arn           = dependency.cluster.outputs.cluster_arn
  execution_role_arn    = dependency.cluster.outputs.execution_role_arn
  vpc_id                = dependency.network.outputs.vpc_id
  subnet_ids            = dependency.network.outputs.public_subnet_ids
  alb_security_group_id = dependency.alb.outputs.security_group_id
  target_group_arn      = dependency.alb.outputs.target_group_arns["web"]
  use_spot              = local.env_vars.use_spot
}
