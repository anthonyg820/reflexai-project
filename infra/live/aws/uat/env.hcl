locals {
  env = "uat"
  # Fargate Spot in UAT: ~70% cheaper; interruptions are acceptable here.
  use_spot = true
}
