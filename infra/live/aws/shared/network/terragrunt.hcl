include "root" {
  path   = find_in_parent_folders("root.hcl")
  expose = true
}

include "cloud" {
  path   = find_in_parent_folders("cloud.hcl")
  expose = true
}

terraform {
  source = "${get_repo_root()}/infra/modules//aws-network"
}

inputs = {
  name = "rehearse"
}
