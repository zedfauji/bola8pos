param(
  [string]$ProjectId = "YOUR_PROJECT_ID",
  [string]$Region = "us-central1",
  [string]$Repo = "pos-artifacts",
  [string]$Tag = "v1"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-GcloudPath {
  if ($env:GCLOUD_PATH -and (Test-Path $env:GCLOUD_PATH)) { return $env:GCLOUD_PATH }
  $cmd = Get-Command gcloud -ErrorAction SilentlyContinue
  if ($cmd) { return 'gcloud' }
  return $null
}

$global:Gcloud = Resolve-GcloudPath
if (-not $global:Gcloud) { throw 'gcloud CLI not found in PATH. Install Google Cloud SDK or set GCLOUD_PATH.' }

function Gcloud([string[]]$ArgsArray) {
  Write-Host "==> gcloud $($ArgsArray -join ' ')" -ForegroundColor Cyan
  & $global:Gcloud @ArgsArray
  if ($LASTEXITCODE -ne 0) { throw "gcloud failed: $($ArgsArray -join ' ')" }
}

Gcloud @('config','set','project',$ProjectId)
Gcloud @('services','enable','artifactregistry.googleapis.com','run.googleapis.com','cloudbuild.googleapis.com')

Write-Host 'Deploying backend...' -ForegroundColor Green
Push-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
Push-Location (Resolve-Path (Join-Path (Get-Location) 'backend'))
$subs = "_REGION=$Region,_REPO=$Repo,_TAG=$Tag"
Gcloud @('builds','submit','--config','cloudbuild.yaml','--substitutions',$subs)
$backendUrl = (& $global:Gcloud 'run' 'services' 'describe' 'pos-backend' '--region' $Region '--format=value(status.url)').Trim()
if (-not $backendUrl) { throw 'Backend URL not found' }
Pop-Location

Write-Host "Deploying frontend with API URL: $backendUrl" -ForegroundColor Green
Push-Location (Resolve-Path (Join-Path (Get-Location) 'frontend'))
$subs = "_REGION=$Region,_REPO=$Repo,_TAG=$Tag,_API_URL=$backendUrl"
Gcloud @('builds','submit','--config','cloudbuild.yaml','--substitutions',$subs)
$frontendUrl = (& $global:Gcloud 'run' 'services' 'describe' 'pos-frontend' '--region' $Region '--format=value(status.url)').Trim()
Pop-Location
Pop-Location

Write-Host "Backend:  $backendUrl" -ForegroundColor Yellow
Write-Host "Frontend: $frontendUrl" -ForegroundColor Yellow


