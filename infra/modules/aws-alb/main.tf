# Public ALB per environment. /api/* goes straight to the api; everything
# else goes to web (whose own /api proxy is therefore only used on GCP).
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.0, < 7.0" }
  }
}

variable "name" {
  type        = string
  description = "e.g. rehearse-prod"
}
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }

resource "aws_security_group" "alb" {
  name        = "${var.name}-alb"
  description = "Public HTTP to the ALB"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "this" {
  name               = var.name
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.subnet_ids
}

resource "aws_lb_target_group" "service" {
  for_each             = toset(["web", "api"])
  name                 = "${var.name}-${each.key}"
  port                 = 8080
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = var.vpc_id
  deregistration_delay = 15

  health_check {
    path                = "/healthz"
    matcher             = "200"
    interval            = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.service["web"].arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.service["api"].arn
  }
  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

output "dns_name" { value = aws_lb.this.dns_name }
output "security_group_id" { value = aws_security_group.alb.id }
output "target_group_arns" { value = { for k, tg in aws_lb_target_group.service : k => tg.arn } }
