param(
  [int]$BackendPort = 3001,
  [int]$FrontendPort = 5173
)

function Stop-PortProcess {
  param([int]$Port)
  try {
    $pids = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique |
      Where-Object { $_ -ne 0 }
    if ($pids) {
      Write-Host "Killing processes on port $($Port): $pids"
      foreach ($procId in $pids) {
        try { Stop-Process -Id $procId -Force -ErrorAction Stop } catch {
          try { & taskkill.exe /PID $procId /F | Out-Null } catch { Write-Warning "Failed to kill PID $($procId): $_" }
        }
      }
      Start-Sleep -Milliseconds 300
    } else {
      Write-Host "No process found on port $Port"
    }
  } catch {
    Write-Warning "Could not inspect/kill port $($Port): $_"
  }
}

# Ensure root at repository (script is under pos/scripts → repo is one level up)
$repo = Split-Path -Parent $PSScriptRoot
$backendCwd = Join-Path $repo 'backend'
$frontendCwd = Join-Path $repo 'frontend'

Write-Host "Repo root: $repo"

# Kill if occupied
Stop-PortProcess -Port $BackendPort
Stop-PortProcess -Port $FrontendPort

# Start backend on 3001 (respects process.env.PORT). Use env vars compatible with Windows PowerShell 5.1
Write-Host "Starting backend on port $BackendPort"
$env:PORT = "$BackendPort"
Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev" -WorkingDirectory $backendCwd -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\pos-backend.out" -RedirectStandardError "$env:TEMP\pos-backend.err" | Out-Null

# Start frontend on 5173 with Vite env
$env:VITE_PORT = "$FrontendPort"
$env:VITE_API_URL = "http://localhost:$BackendPort"
Write-Host "Starting frontend on port $FrontendPort (API -> http://localhost:$($BackendPort))"
Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev" -WorkingDirectory $frontendCwd -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\pos-frontend.out" -RedirectStandardError "$env:TEMP\pos-frontend.err" | Out-Null

Write-Host "Servers launching... Frontend: http://localhost:$($FrontendPort)  Backend: http://localhost:$($BackendPort)"
