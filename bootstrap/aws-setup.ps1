<#
  Step 3: AWS setup (run via "3-aws-setup.cmd").
  - Uses your AWS CLI credentials (runs "aws configure" if there are none)
  - Saves AWS_ACCOUNT_ID / AWS_REGION as user environment variables
  - Runs the first Terragrunt apply for AWS: state bucket, GitHub OIDC roles, ECR,
    VPC, and per environment (uat, prod) an ALB, ECS cluster and service shells
  NOTE: the two ALBs start billing as soon as they exist (about $0.55/day each).
#>
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot\lib.ps1"
$env:PATH = "$(Join-Path (Split-Path $PSScriptRoot -Parent) '.tools\bin');$env:PATH"
Require-Command aws 'Run 1-install-tools.cmd first, then open a NEW window.'
Require-Command terragrunt 'Run 1-install-tools.cmd first.'
$settings = Read-Settings
$region = if ($settings.AWS_REGION) { $settings.AWS_REGION } else { 'us-east-1' }

Step 'Checking AWS credentials'
$account = Capture { aws sts get-caller-identity --query Account --output text }
if (-not $account -or $account -notmatch '^\d{12}$') {
    Write-Host '  No working credentials. Enter the access key of an IAM user with AdministratorAccess.'
    Write-Host "  Use region $region and output format json."
    & aws configure
    $account = (& aws sts get-caller-identity --query Account --output text | Out-String).Trim()
    if ($account -notmatch '^\d{12}$') { throw 'AWS credentials still not working.' }
}
$arn = (& aws sts get-caller-identity --query Arn --output text | Out-String).Trim()
Write-Host "  account $account as $arn"
Save-Setting 'AWS_ACCOUNT_ID' $account
Save-Setting 'AWS_REGION' $region
$env:AWS_ACCOUNT_ID = $account; $env:AWS_REGION = $region

Step 'First Terragrunt apply for AWS'
Write-Host "  This creates, in account $account ($region):"
Write-Host '    - a state bucket, GitHub OIDC roles, 3 ECR repos, a VPC with public subnets'
Write-Host '    - for uat and prod: an ALB, an ECS cluster and 2 ECS services (0 tasks until the first release)'
Write-Host '  Cost: about $1.10/day for the two ALBs while they exist. Tear down later with: .\make aws-pause'
Confirm-Step 'Go ahead?'
Step 'State bucket'
# Created here rather than by Terragrunt's --backend-bootstrap: with several units
# starting in parallel, Terragrunt checks the bucket before creating it and fails.
$bucket = "rehearse-tfstate-$account"
$null = Capture { aws s3api head-bucket --bucket $bucket }
if ($LASTEXITCODE -ne 0) {
    Write-Host "  creating s3://$bucket"
    if ($region -eq 'us-east-1') { Native { aws s3api create-bucket --bucket $bucket --region $region | Out-Null } }
    else { Native { aws s3api create-bucket --bucket $bucket --region $region --create-bucket-configuration LocationConstraint=$region | Out-Null } }
    Native { aws s3api put-bucket-versioning --bucket $bucket --versioning-configuration Status=Enabled }
    $sse = New-TemporaryFile
    Set-Content -Path $sse -Encoding ascii -Value '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
    try { Native { aws s3api put-bucket-encryption --bucket $bucket --server-side-encryption-configuration "file://$sse" } } finally { Remove-Item $sse -Force }
    Native { aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true }
} else { Write-Host "  s3://$bucket already exists" }

Step 'Applying (this takes a few minutes; the load balancers are the slowest part)'
Push-Location infra/live/aws
try { Native { terragrunt run --all --non-interactive --backend-bootstrap -- apply } } finally { Pop-Location }

Step 'Outputs for GitHub (saved to bootstrap\outputs\aws-oidc.txt)'
New-Item -ItemType Directory -Force -Path "$PSScriptRoot\outputs" | Out-Null
Push-Location infra/live/aws/shared/oidc
try { & terragrunt output | Tee-Object "$PSScriptRoot\outputs\aws-oidc.txt" } finally { Pop-Location }
Save-Setting 'AWS_READY' 'true'
Done "AWS is set up in account $account."
