<#
  Step 7: repository rules for the Scenario B review policy (run via "7-repo-rules.cmd").
  Safe to re-run: everything is created or updated in place.
  - Turns on auto-merge and "delete branch after merge"
  - Lets GitHub Actions create pull requests (the Scenario B demo opens its PRs that way)
  - Ruleset "main": required checks (CI + review-policy), code-owner review on platform paths,
    no force pushes or deletion. Repository admins (you) can bypass, so pushing straight
    to main keeps working.
  - Ruleset "demo-queue": the same checks and reviews on demo/queue-base, with no bypass,
    so the demo PRs show the real behaviour.
#>
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot\lib.ps1"
$env:PATH = "$(Join-Path (Split-Path $PSScriptRoot -Parent) '.tools\bin');$env:PATH"
Require-Command gh 'Run 1-install-tools.cmd first, then open a NEW window.'

Step 'Signing in to GitHub'
Capture { gh auth status } | Out-Null; $ok = $LASTEXITCODE -eq 0
if (-not $ok) { & gh auth login --web --git-protocol https }
$repo = (& gh repo view --json nameWithOwner -q .nameWithOwner | Out-String).Trim()
Write-Host "  repository $repo"

function Invoke-GhJson([string] $Method, [string] $Path, $Body) {
    # Pass the body as a UTF-8 file without a BOM (piping JSON into gh from Windows PowerShell can corrupt it).
    $file = New-TemporaryFile
    [IO.File]::WriteAllText($file, ($Body | ConvertTo-Json -Depth 10 -Compress), (New-Object Text.UTF8Encoding $false))
    try { $out = (& gh api -X $Method $Path --input $file.FullName | Out-String) } finally { Remove-Item $file -Force }
    if ($LASTEXITCODE -ne 0) { throw "gh api $Method $Path failed" }
    return $out
}

Step 'Repository settings'
Invoke-GhJson 'PATCH' "repos/$repo" @{ allow_auto_merge = $true; delete_branch_on_merge = $true; allow_squash_merge = $true } | Out-Null
Write-Host '  auto-merge on, branches deleted after merge'
Invoke-GhJson 'PUT' "repos/$repo/actions/permissions/workflow" @{ default_workflow_permissions = 'read'; can_approve_pull_request_reviews = $true } | Out-Null
Write-Host '  GitHub Actions may create pull requests (the review policy ignores bot approvals)'

$checks = @(
    @{ context = 'Lint, typecheck, test, build' },
    @{ context = 'review-policy' }
)
$prRule = @{
    type       = 'pull_request'
    parameters = @{
        required_approving_review_count   = 0      # the review-policy status decides per risk tier
        dismiss_stale_reviews_on_push     = $true
        require_code_owner_review         = $true  # platform paths (.github/CODEOWNERS)
        require_last_push_approval        = $false
        required_review_thread_resolution = $false
    }
}
# do_not_enforce_on_create: the Scenario B demo creates demo/queue-base by pushing a copy of main;
# a brand-new branch has no statuses yet, so enforcing checks on creation would reject that push.
$checksRule = @{ type = 'required_status_checks'; parameters = @{ strict_required_status_checks_policy = $false; do_not_enforce_on_create = $true; required_status_checks = $checks } }

$rulesets = @(
    @{
        name          = 'main'
        target        = 'branch'
        enforcement   = 'active'
        conditions    = @{ ref_name = @{ include = @('~DEFAULT_BRANCH'); exclude = @() } }
        bypass_actors = @(@{ actor_id = 5; actor_type = 'RepositoryRole'; bypass_mode = 'always' })  # 5 = admin
        rules         = @(@{ type = 'deletion' }, @{ type = 'non_fast_forward' }, $prRule, $checksRule)
    },
    @{
        name          = 'demo-queue'
        target        = 'branch'
        enforcement   = 'active'
        conditions    = @{ ref_name = @{ include = @('refs/heads/demo/queue-base'); exclude = @() } }
        bypass_actors = @()
        rules         = @($prRule, $checksRule)
    }
)

Step 'Rulesets'
$existing = (& gh api "repos/$repo/rulesets" | Out-String) | ConvertFrom-Json
foreach ($rs in $rulesets) {
    $match = @($existing | Where-Object { $_.name -eq $rs.name })
    if ($match.Count -gt 0) { Invoke-GhJson 'PUT' "repos/$repo/rulesets/$($match[0].id)" $rs | Out-Null; Write-Host "  updated $($rs.name)" }
    else { Invoke-GhJson 'POST' "repos/$repo/rulesets" $rs | Out-Null; Write-Host "  created $($rs.name)" }
}

Write-Host ''
Write-Host '  Note: the "production" environment allows self-approval because you are the only reviewer.' -ForegroundColor Yellow
Write-Host '  With a real team, turn on "Prevent self-review" there so a second person approves every prod deploy.' -ForegroundColor Yellow
Done 'Repository rules are set. Run "Demo: Scenario B" (mode=open) from the Actions tab.'
