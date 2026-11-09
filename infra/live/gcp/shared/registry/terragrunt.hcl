include "root" {
  path   = find_in_parent_folders("root.hcl")
  expose = true
}

include "cloud" {
  path   = find_in_parent_folders("cloud.hcl")
  expose = true
}

terraform {
  source = "${get_repo_root()}/infra/modules//gcp-artifact-registry"
}

dependencies {
  paths = ["../services"]
}

inputs = {
  project_id = include.cloud.locals.project_id
  region     = include.cloud.locals.region
}
