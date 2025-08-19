param (
    [Parameter(Position=0)]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [string]$App = "all"
)

$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ecosystemConfig = Join-Path -Path $rootDir -ChildPath "ecosystem.config.js"

function Show-Help {
    Write-Host "POS System PM2 Management Script" -ForegroundColor Cyan
    Write-Host "=================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\manage-pm2.ps1 [command] [app]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Green
    Write-Host "  start       - Start the application(s)"
    Write-Host "  stop        - Stop the application(s)"
    Write-Host "  restart     - Restart the application(s)"
    Write-Host "  reload      - Reload the application(s) with zero downtime"
    Write-Host "  delete      - Delete the application(s) from PM2"
    Write-Host "  status      - Show status of the application(s)"
    Write-Host "  logs        - Show logs of the application(s) with --nostream flag"
    Write-Host "  monit       - Open PM2 monitoring"
    Write-Host "  flush       - Flush all application logs"
    Write-Host "  save        - Save the current process list"
    Write-Host "  startup     - Setup PM2 to start on system boot"
    Write-Host "  help        - Show this help message"
    Write-Host ""
    Write-Host "Apps:" -ForegroundColor Green
    Write-Host "  all         - All applications (default)"
    Write-Host "  backend     - Backend application only"
    Write-Host "  frontend    - Frontend application only"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\manage-pm2.ps1 start"
    Write-Host "  .\manage-pm2.ps1 logs backend"
    Write-Host "  .\manage-pm2.ps1 restart frontend"
}

function Ensure-PM2-Installed {
    try {
        $null = & pm2 --version
    }
    catch {
        Write-Host "PM2 is not installed. Installing PM2 globally..." -ForegroundColor Yellow
        & npm install -g pm2
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to install PM2. Please install it manually with 'npm install -g pm2'" -ForegroundColor Red
            exit 1
        }
    }
}

function Get-App-Name {
    param (
        [string]$App
    )
    
    switch ($App) {
        "backend" { return "pos-backend" }
        "frontend" { return "pos-frontend" }
        default { return "all" }
    }
}

# Ensure PM2 is installed
Ensure-PM2-Installed

# Get the app name
$appName = Get-App-Name -App $App

# Execute the command
switch ($Command) {
    "start" {
        if ($appName -eq "all") {
            Write-Host "Starting all applications..." -ForegroundColor Cyan
            & pm2 start $ecosystemConfig
        } else {
            Write-Host "Starting $appName..." -ForegroundColor Cyan
            & pm2 start $ecosystemConfig --only $appName
        }
    }
    "stop" {
        if ($appName -eq "all") {
            Write-Host "Stopping all applications..." -ForegroundColor Cyan
            & pm2 stop all
        } else {
            Write-Host "Stopping $appName..." -ForegroundColor Cyan
            & pm2 stop $appName
        }
    }
    "restart" {
        if ($appName -eq "all") {
            Write-Host "Restarting all applications..." -ForegroundColor Cyan
            & pm2 restart all
        } else {
            Write-Host "Restarting $appName..." -ForegroundColor Cyan
            & pm2 restart $appName
        }
    }
    "reload" {
        if ($appName -eq "all") {
            Write-Host "Reloading all applications..." -ForegroundColor Cyan
            & pm2 reload all
        } else {
            Write-Host "Reloading $appName..." -ForegroundColor Cyan
            & pm2 reload $appName
        }
    }
    "delete" {
        if ($appName -eq "all") {
            Write-Host "Deleting all applications..." -ForegroundColor Cyan
            & pm2 delete all
        } else {
            Write-Host "Deleting $appName..." -ForegroundColor Cyan
            & pm2 delete $appName
        }
    }
    "status" {
        Write-Host "Showing status..." -ForegroundColor Cyan
        & pm2 status
    }
    "logs" {
        if ($appName -eq "all") {
            Write-Host "Showing logs for all applications..." -ForegroundColor Cyan
            & pm2 logs --nostream
        } else {
            Write-Host "Showing logs for $appName..." -ForegroundColor Cyan
            & pm2 logs $appName --nostream
        }
    }
    "monit" {
        Write-Host "Opening PM2 monitoring..." -ForegroundColor Cyan
        & pm2 monit
    }
    "flush" {
        Write-Host "Flushing all logs..." -ForegroundColor Cyan
        & pm2 flush
    }
    "save" {
        Write-Host "Saving current process list..." -ForegroundColor Cyan
        & pm2 save
    }
    "startup" {
        Write-Host "Setting up PM2 to start on system boot..." -ForegroundColor Cyan
        & pm2 startup
    }
    default {
        Show-Help
    }
}
