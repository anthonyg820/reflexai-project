## What & why

## Risk
- [ ] Touches infra, deploy specs, migrations or auth (needs a platform code owner)
- [ ] Changes runtime config (`deploy/config/*`): shipped with the image, validated in CI
- [ ] Database migration is backward compatible with the previous release (expand/contract)

## How I verified it
