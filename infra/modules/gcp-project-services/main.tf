# Enables the Google APIs the stack needs.
terraform {
  required_providers {
    google = { source = "hashicorp/google", version = ">= 6.0, < 8.0" }
  }
}

variable "project_id" { type = string }
variable "services" {
  type = list(string)
  default = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "logging.googleapis.com",
  ]
}

resource "google_project_service" "this" {
  for_each           = toset(var.services)
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

output "enabled" { value = [for s in google_project_service.this : s.service] }
