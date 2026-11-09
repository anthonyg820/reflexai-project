# Secret containers only. Values are added out of band so they never land in
# Terraform state:  gcloud secrets versions add <id> --data-file=-
terraform {
  required_providers {
    google = { source = "hashicorp/google", version = ">= 6.0, < 8.0" }
  }
}

variable "project_id" { type = string }
variable "env" { type = string }
variable "names" {
  type    = list(string)
  default = ["database-url", "grafana-otlp-token"]
}

resource "google_secret_manager_secret" "this" {
  for_each  = toset(var.names)
  project   = var.project_id
  secret_id = "rehearse-${var.env}-${each.value}"
  replication {
    auto {}
  }
  labels = { app = "rehearse", env = var.env }
}

output "secret_ids" { value = { for k, s in google_secret_manager_secret.this : k => s.secret_id } }
