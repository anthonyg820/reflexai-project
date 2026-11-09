# Shared definition for gcp/<env>/secrets. The env comes from <env>/env.hcl.
locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals.env
}

terraform {
  source = "${get_repo_root()}/infra/modules//gcp-secrets"
}

# APIs must be enabled before anything in an environment can be created.
dependencies {
  paths = ["${get_terragrunt_dir()}/../../shared/services"]
}

inputs = {
  env = local.env
}
