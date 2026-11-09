# Cloud Run service SHELL: identity, IAM, ingress and the service resource.
#
# Terraform deliberately does NOT own the revision (image, env, sidecar,
# probes). That lives in deploy/cloudrun/<service>.yaml and is applied by the
# release workflow together with the image digest, so config and code can
# never be rolled out separately (Scenario A).
terraform {
  required_providers {
    google = { source = "hashicorp/google", version = ">= 6.0, < 8.0" }
  }
}

variable "project_id" { type = string }
variable "region" { type = string }
variable "name" {
  type        = string
  description = "Service name, e.g. rehearse-prod-api (also the runtime SA id)"
}
variable "secret_ids" {
  type        = list(string)
  default     = []
  description = "Secret Manager secret ids the runtime SA may read"
}
variable "deployer_service_account" {
  type        = string
  description = "CI deployer SA that must be able to act as the runtime SA"
}
variable "public" {
  type    = bool
  default = true
}

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = var.name
  display_name = "Runtime identity for ${var.name}"
}

resource "google_secret_manager_secret_iam_member" "runtime" {
  for_each  = toset(var.secret_ids)
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_service_account_iam_member" "deployer_act_as" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${var.deployer_service_account}"
}

resource "google_cloud_run_v2_service" "this" {
  project             = var.project_id
  location            = var.region
  name                = var.name
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.runtime.email
    # Placeholder until the first release replaces the revision.
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"
      ports {
        container_port = 8080
      }
    }
  }

  lifecycle {
    # Owned by the release workflow (deploy/cloudrun/*.yaml).
    ignore_changes = [template, traffic, client, client_version, labels, annotations]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  count    = var.public ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "name" { value = google_cloud_run_v2_service.this.name }
output "uri" { value = google_cloud_run_v2_service.this.uri }
output "runtime_service_account" { value = google_service_account.runtime.email }
