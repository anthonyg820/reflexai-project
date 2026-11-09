include "root" {
  path   = find_in_parent_folders("root.hcl")
  expose = true
}

include "cloud" {
  path   = find_in_parent_folders("cloud.hcl")
  expose = true
}

include "common" {
  path   = "${dirname(find_in_parent_folders("cloud.hcl"))}/_common/secrets.hcl"
  expose = true
}
