# ECS service SHELL: security group, task role, log group and the service.
#
# Terraform deliberately does NOT own the task definition the service runs.
# deploy/ecs/<service>.json is rendered with the image digest + config and
# registered by the release workflow as ONE revision (Scenario A fix).
# Terraform only registers a bootstrap definition and starts at 0 tasks.
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.0, < 7.0" }
  }
}

variable "name" {
  type        = string
  description = "e.g. rehearse-prod-api (also the task definition family)"
}
variable "container_name" {
  type        = string
  description = "api or web"
}
variable "cluster_arn" { type = string }
variable "execution_role_arn" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "alb_security_group_id" { type = string }
variable "target_group_arn" { type = string }
variable "use_spot" {
  type    = bool
  default = false
}
variable "log_retention_days" {
  type    = number
  default = 3
}

data "aws_region" "current" {}

resource "aws_security_group" "task" {
  name        = "${var.name}-task"
  description = "Only the ALB may reach ${var.name}"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_iam_role" "task" {
  name = "${var.name}-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_ecs_task_definition" "bootstrap" {
  family                   = var.name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions = jsonencode([{
    name         = var.container_name
    image        = "public.ecr.aws/docker/library/busybox:stable"
    essential    = true
    command      = ["sh", "-c", "echo 'bootstrap task definition; awaiting first release' && sleep 3600"]
    portMappings = [{ containerPort = 8080, protocol = "tcp" }]
  }])

  lifecycle {
    # Later revisions in this family are registered by releases.
    ignore_changes = all
  }
}

resource "aws_ecs_service" "this" {
  name                              = var.name
  cluster                           = var.cluster_arn
  task_definition                   = aws_ecs_task_definition.bootstrap.arn
  desired_count                     = 0
  health_check_grace_period_seconds = 30
  enable_execute_command            = false
  propagate_tags                    = "TASK_DEFINITION"

  capacity_provider_strategy {
    capacity_provider = var.use_spot ? "FARGATE_SPOT" : "FARGATE"
    weight            = 1
  }

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.task.id]
    assign_public_ip = true # no NAT gateway; SG still blocks inbound except from the ALB
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.container_name
    container_port   = 8080
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  lifecycle {
    # Owned by the release workflow.
    ignore_changes = [task_definition, desired_count]
  }
}

output "service_name" { value = aws_ecs_service.this.name }
output "task_role_arn" { value = aws_iam_role.task.arn }
output "log_group_name" { value = aws_cloudwatch_log_group.this.name }
