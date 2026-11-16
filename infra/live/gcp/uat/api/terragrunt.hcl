include "root" {
  path   = find_in_parent_folders("root.hcl")
  expose = true
}

include "cloud" {
  path   = find_in_parent_folders("cloud.hcl")
  expose = true
}

include "common" {
  path   = "${dirname(find_in_parent_folders("cloud.hcl"))}/_common/api.hcl"
  expose = true
}

inputs = {
  project_id = include.cloud.locals.project_id
  region     = include.cloud.locals.region

  # UAT api only for authenticated callers (the web service and testers with IAM).
  public = false
}
