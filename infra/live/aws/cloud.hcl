# AWS settings for every unit under infra/live/aws.
# Set AWS_ACCOUNT_ID (and optionally AWS_REGION) in your shell or CI.
locals {
  account_id = get_env("AWS_ACCOUNT_ID")
  region     = get_env("AWS_REGION", "us-east-1")
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket       = "rehearse-tfstate-${local.account_id}"
    key          = "aws/${path_relative_to_include()}/terraform.tfstate"
    region       = local.region
    encrypt      = true
    use_lockfile = true # S3-native locking, no DynamoDB table needed
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region              = "${local.region}"
  allowed_account_ids = ["${local.account_id}"]
  default_tags {
    tags = {
      app        = "rehearse"
      managed-by = "terragrunt"
    }
  }
}
EOF
}
