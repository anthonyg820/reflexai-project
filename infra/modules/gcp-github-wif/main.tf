# Keyless GitHub Actions -> GCP auth via Workload Identity Federation.
# Two service accounts: one for releases (narrow), one for Terraform (broad).
terraform {
  required_providers {
    google = { source = "hashicorp/google", version = ">= 6.0, < 8.0" }
  }
}

variable "project_id" { type = string }
variable "github_repository" {
  type        = string
  description = "owner/repo allowed to assume these identities"
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub OIDC"
  attribute_mapping = {
    "google.subject"         = "assertion.sub"
    "attribute.repository"   = "assertion.repository"
    "attribute.ref"          = "assertion.ref"
    "attribute.environment"  = "assertion.environment"
    "attribute.workflow_ref" = "assertion.job_workflow_ref"
  }
  attribute_condition = "assertion.repository == '${var.github_repository}'"
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

locals {
  principal_set = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"

  deployer_roles = [
    "roles/run.developer",
    "roles/artifactregistry.writer",
  ]
  # Broad on purpose for a demo project; production would scope this per stack.
  terraform_roles = [
    "roles/editor",
    "roles/resourcemanager.projectIamAdmin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/secretmanager.admin",
    "roles/run.admin",
    "roles/storage.admin",
  ]
}

resource "google_service_account" "deployer" {
  project      = var.project_id
  account_id   = "ci-deployer"
  display_name = "GitHub Actions release deployer"
}

resource "google_service_account" "terraform" {
  project      = var.project_id
  account_id   = "ci-terraform"
  display_name = "GitHub Actions Terraform"
}

resource "google_project_iam_member" "deployer" {
  for_each = toset(local.deployer_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_project_iam_member" "terraform" {
  for_each = toset(local.terraform_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.terraform.email}"
}

resource "google_service_account_iam_member" "deployer_wif" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.principal_set
}

resource "google_service_account_iam_member" "terraform_wif" {
  service_account_id = google_service_account.terraform.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.principal_set
}

output "workload_identity_provider" { value = google_iam_workload_identity_pool_provider.github.name }
output "deployer_service_account" { value = google_service_account.deployer.email }
output "terraform_service_account" { value = google_service_account.terraform.email }
