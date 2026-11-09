# SecureString parameters (free tier, unlike Secrets Manager at $0.40/secret).
# Terraform creates them with a placeholder and ignores the value afterwards;
# set the real value out of band so it never lands in state:
#   aws ssm put-parameter --name /rehearse/<env>/database-url --type SecureString --overwrite --value '...'
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.0, < 7.0" }
  }
}

variable "env" { type = string }
variable "names" {
  type    = list(string)
  default = ["database-url", "grafana-otlp-token"]
}

resource "aws_ssm_parameter" "this" {
  for_each = toset(var.names)
  name     = "/rehearse/${var.env}/${each.value}"
  type     = "SecureString"
  value    = "CHANGE_ME"
  lifecycle {
    ignore_changes = [value]
  }
}

output "parameter_arns" { value = { for k, p in aws_ssm_parameter.this : k => p.arn } }
output "path_prefix" { value = "/rehearse/${var.env}/" }
