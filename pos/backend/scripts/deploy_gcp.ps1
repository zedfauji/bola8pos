param(
  [string]$ProjectId = "bola8pos",
  [string]$Region = "us-central1",
  [string]$Repo = "pos-artifacts",
  [string]$Tag = "v1"
)

# Ensure we run from backend root (so cloudbuild.yaml is found)
Set-Location -Path (Resolve-Path (Join-Path $PSScriptRoot ".."))

function Resolve-GcloudPath {
  $cmd = Get-Command gcloud -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    Join-Path ${env:ProgramFiles}      "Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    Join-Path ${env:ProgramFiles(x86)} "Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    Join-Path ${env:LOCALAPPDATA}      "Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
  )
  foreach ($p in $candidates) { if (Test-Path $p) { return $p } }
  return $null
}

$global:Gcloud = Resolve-GcloudPath
if (-not $global:Gcloud) {
  throw "gcloud CLI not found. Please install Google Cloud SDK or ensure gcloud is in PATH."
}

function Gcloud([string[]]$ArgsArray) {
  Write-Host "==> gcloud $($ArgsArray -join ' ')" -ForegroundColor Cyan
  & $global:Gcloud @ArgsArray
  if ($LASTEXITCODE -ne 0) { throw "gcloud command failed: $($ArgsArray -join ' ')" }
}

try {
  Gcloud @('--version')
  Gcloud @('config','set','project', $ProjectId)

  Write-Host "Enabling required APIs..." -ForegroundColor Green
  Gcloud @('services','enable','artifactregistry.googleapis.com','run.googleapis.com','cloudbuild.googleapis.com')

  Write-Host "Ensuring Artifact Registry repo '$Repo' in $Region..." -ForegroundColor Green
  & $global:Gcloud artifacts repositories describe $Repo --location $Region *> $null
  if ($LASTEXITCODE -ne 0) {
    Gcloud @('artifacts','repositories','create',$Repo,'--repository-format=docker','--location',$Region,'--description','POS images')
  } else {
    Write-Host "Artifact Registry repo exists" -ForegroundColor Yellow
  }

  Write-Host "Granting Cloud Build deploy permissions..." -ForegroundColor Green
  $projectNumber = (& $global:Gcloud 'projects' 'describe' $ProjectId '--format=value(projectNumber)').Trim()
  if ($LASTEXITCODE -ne 0 -or -not $projectNumber) { throw "Unable to get project number" }
  $cbSa = "$projectNumber@cloudbuild.gserviceaccount.com"
  & $global:Gcloud projects add-iam-policy-binding $ProjectId --member=serviceAccount:$cbSa --role=roles/run.admin *> $null
  & $global:Gcloud projects add-iam-policy-binding $ProjectId --member=serviceAccount:$cbSa --role=roles/iam.serviceAccountUser *> $null

  Write-Host "Submitting Cloud Build... (this can take a few minutes)" -ForegroundColor Green
  $subs = "_REGION=$Region,_REPO=$Repo,_TAG=$Tag"
  Gcloud @('builds','submit','--config','cloudbuild.yaml','--substitutions',$subs)

  Write-Host "Fetching Cloud Run service URL..." -ForegroundColor Green
  $url = (& $global:Gcloud 'run' 'services' 'describe' 'pos-backend' '--region' $Region '--format=value(status.url)').Trim()
  if (-not $url) { throw "Cloud Run service URL not found" }
  Write-Host "Cloud Run URL: $url" -ForegroundColor Green

  Write-Host "Verifying /health endpoint..." -ForegroundColor Green
  try {
    $health = (Invoke-WebRequest -UseBasicParsing "$url/health").Content
    Write-Host "Health: $health" -ForegroundColor Green
  } catch {
    Write-Host "Health check failed; service may still be warming up." -ForegroundColor Yellow
  }

  Write-Host "Updating free-tier settings explicitly..." -ForegroundColor Green
  & $global:Gcloud 'run' 'services' 'update' 'pos-backend' '--region' $Region '--min-instances' '0' '--max-instances' '1' '--memory' '256Mi' '--cpu' '1' '--concurrency' '80' *> $null

  Write-Host "Ensuring unauthenticated invoker (public access)..." -ForegroundColor Green
  & $global:Gcloud 'beta' 'run' 'services' 'add-iam-policy-binding' 'pos-backend' '--region' $Region '--member' 'allUsers' '--role' 'roles/run.invoker' *> $null
  Write-Host "Deployment complete." -ForegroundColor Green

  Write-Host "To deploy frontend bound to this backend, run:" -ForegroundColor Yellow
  Write-Host "  cd ..\\frontend" -ForegroundColor Yellow
  Write-Host "  gcloud builds submit --config cloudbuild.yaml --substitutions _REGION=$Region,_REPO=$Repo,_TAG=$Tag,_API_URL=$url" -ForegroundColor Yellow
} catch {
  Write-Error $_
  exit 1
}


