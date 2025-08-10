# POS System Deployment Script for Google Cloud
# This script builds Docker images and deploys using Terraform

param(
    [string]$ProjectId = "bola8pos",
    [string]$Region = "us-central1",
    [string]$Repo = "pos-artifacts",
    [string]$Tag = "v1"
)

Write-Host "🚀 Starting POS System Deployment..." -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "Repository: $Repo" -ForegroundColor Cyan
Write-Host "Tag: $Tag" -ForegroundColor Cyan

# Check if Docker is running
try {
    docker version | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if gcloud is authenticated
try {
    $currentProject = gcloud config get-value project 2>$null
    if ($currentProject -eq $ProjectId) {
        Write-Host "✅ gcloud authenticated and project set to $ProjectId" -ForegroundColor Green
    } else {
        Write-Host "⚠️  gcloud project is set to $currentProject, switching to $ProjectId" -ForegroundColor Yellow
        gcloud config set project $ProjectId
    }
} catch {
    Write-Host "❌ gcloud not authenticated. Please run: gcloud auth login" -ForegroundColor Red
    exit 1
}

# Build and push backend image
Write-Host "🔨 Building backend image..." -ForegroundColor Yellow
Set-Location backend
docker build -t "$Region-docker.pkg.dev/$ProjectId/$Repo/pos-backend:$Tag" .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend build failed" -ForegroundColor Red
    exit 1
}

Write-Host "📤 Pushing backend image..." -ForegroundColor Yellow
docker push "$Region-docker.pkg.dev/$ProjectId/$Repo/pos-backend:$Tag"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend push failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Backend image pushed successfully" -ForegroundColor Green

# Get backend URL for frontend build
Write-Host "🔍 Getting backend URL..." -ForegroundColor Yellow
$backendUrl = gcloud run services describe pos-backend --region $Region --format='value(status.url)' 2>$null
if (-not $backendUrl) {
    Write-Host "⚠️  Could not get backend URL, using default" -ForegroundColor Yellow
    $backendUrl = "https://pos-backend-23sbzjsxaq-uc.a.run.app"
}
Write-Host "Backend URL: $backendUrl" -ForegroundColor Cyan

# Build and push frontend image
Write-Host "🔨 Building frontend image..." -ForegroundColor Yellow
Set-Location ../frontend
docker build --build-arg VITE_API_URL=$backendUrl -t "$Region-docker.pkg.dev/$ProjectId/$Repo/pos-frontend:$Tag" .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed" -ForegroundColor Red
    exit 1
}

Write-Host "📤 Pushing frontend image..." -ForegroundColor Yellow
docker push "$Region-docker.pkg.dev/$ProjectId/$Repo/pos-frontend:$Tag"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend push failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Frontend image pushed successfully" -ForegroundColor Green

# Deploy using Terraform
Write-Host "🏗️  Deploying infrastructure with Terraform..." -ForegroundColor Yellow
Set-Location ../../iac/terraform

# Check if Terraform is installed
try {
    terraform version | Out-Null
    Write-Host "✅ Terraform is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Terraform is not installed. Please install Terraform." -ForegroundColor Red
    exit 1
}

# Initialize Terraform if needed
if (-not (Test-Path ".terraform")) {
    Write-Host "🔧 Initializing Terraform..." -ForegroundColor Yellow
    terraform init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Terraform init failed" -ForegroundColor Red
        exit 1
    }
}

# Plan and apply
Write-Host "📋 Planning Terraform deployment..." -ForegroundColor Yellow
terraform plan -var "project_id=$ProjectId" -var "region=$Region" -var "repo=$Repo" -var "tag=$Tag"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Terraform plan failed" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Applying Terraform configuration..." -ForegroundColor Yellow
terraform apply -auto-approve -var "project_id=$ProjectId" -var "region=$Region" -var "repo=$Repo" -var "tag=$Tag"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Terraform apply failed" -ForegroundColor Red
    exit 1
}

# Get service URLs
Write-Host "🔍 Getting service URLs..." -ForegroundColor Yellow
$backendUrl = terraform output -raw backend_url
$frontendUrl = terraform output -raw frontend_url

Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
Write-Host "Backend URL: $backendUrl" -ForegroundColor Cyan
Write-Host "Frontend URL: $frontendUrl" -ForegroundColor Cyan

# Return to original directory
Set-Location ../../

Write-Host "✅ POS System is now deployed and running!" -ForegroundColor Green

