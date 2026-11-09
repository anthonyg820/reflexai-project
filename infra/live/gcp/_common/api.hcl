# Shared definition for gcp/<env>/api: the Cloud Run service shell.
locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals.env
}

terraform {
  source = "${get_repo_root()}/infra/modules//gcp-cloud-run-service"
}

dependency "secrets" {
  config_path = "${get_terragrunt_dir()}/../secrets"
  mock_outputs = {
    secret_ids = { "database-url" = "mock-database-url", "grafana-otlp-token" = "mock-grafana-otlp-token" }
  }
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
}

dependency "wif" {
  config_path = "${get_terragrunt_dir()}/../../shared/wif"
  mock_outputs = {
    deployer_service_account = "ci-deployer@mock.iam.gserviceaccount.com"
  }
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
}

inputs = {
  name                     = "rehearse-${local.env}-api"
  secret_ids               = values(dependency.secrets.outputs.secret_ids)
  deployer_service_account = dependency.wif.outputs.deployer_service_account
}
