param(
  [int]$Port = 5173,
  [int]$WaitSeconds = 120
)

$ErrorActionPreference = 'Stop'
$frontend = Join-Path $PSScriptRoot '..\frontend'
$logOut = Join-Path $env:TEMP 'pos-frontend.out.log'
$logErr = Join-Path $env:TEMP 'pos-frontend.err.log'

# Debug: print environment and tool versions
Write-Host "[DEBUG] Frontend dir: $frontend" -ForegroundColor DarkGray
Write-Host "[DEBUG] Logs: out=$logOut err=$logErr" -ForegroundColor DarkGray
try { Write-Host ("[DEBUG] Node: {0}" -f (node -v)) -ForegroundColor DarkGray } catch { Write-Host "[DEBUG] Node: not found" -ForegroundColor DarkGray }
try { Write-Host ("[DEBUG] npm:  {0}" -f (npm -v)) -ForegroundColor DarkGray } catch { Write-Host "[DEBUG] npm: not found" -ForegroundColor DarkGray }
try { Write-Host ("[DEBUG] npx:  {0}" -f (npx -v)) -ForegroundColor DarkGray } catch { Write-Host "[DEBUG] npx: not found" -ForegroundColor DarkGray }

# Kill anything on the port just in case (best-effort)
# Set PORT env so the Node one-liner can read it via process.env.PORT
$env:PORT = "$Port"
try {
  node -e "(async()=>{try{const p=Number(process.env.PORT)||5173; await require('kill-port')(p)}catch(e){}})()" | Out-Null
} catch {}

Write-Host "Starting Vite dev server on port $Port ..." -ForegroundColor Cyan
# Ensure we call npm.cmd on Windows
$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCmd) { $npmCmd = "npm.cmd" }
Write-Host "[DEBUG] Using npm: $npmCmd" -ForegroundColor DarkGray
$dev = Start-Process -FilePath $npmCmd -ArgumentList @("run","dev") -WorkingDirectory $frontend -PassThru -RedirectStandardOutput $logOut -RedirectStandardError $logErr

# Wait for server readiness by polling HTTP
$deadline = (Get-Date).AddSeconds($WaitSeconds)
$ready = $false
while(-not $ready -and (Get-Date) -lt $deadline) {
  try {
    $resp = Invoke-WebRequest -Uri "http://localhost:$Port" -UseBasicParsing -TimeoutSec 2
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { $ready = $true; break }
  } catch {}
  Start-Sleep -Seconds 1
}

if (-not $ready) {
  Write-Warning "Dev server did not become ready within $WaitSeconds seconds. Check logs at:`n  $logOut`n  $logErr"
  try { Stop-Process -Id $dev.Id -Force } catch {}
  exit 1
}

Write-Host "Dev server is ready. Running Playwright tests..." -ForegroundColor Green

# Run Playwright in foreground to stream output
Push-Location $frontend
$env:E2E_URL = "http://localhost:$Port"
 # Resolve npx and local playwright bin for reliability on Windows
 $npxCmd = (Get-Command npx.cmd -ErrorAction SilentlyContinue).Source
 if (-not $npxCmd) { $npxCmd = "npx.cmd" }
 $playwrightBin = Join-Path $frontend 'node_modules\.bin\playwright.cmd'
 Write-Host "[DEBUG] Using npx: $npxCmd" -ForegroundColor DarkGray
 Write-Host "[DEBUG] Local playwright bin: $playwrightBin (exists=$([System.IO.File]::Exists($playwrightBin)))" -ForegroundColor DarkGray

 try {
   if (Test-Path $playwrightBin) {
     Write-Host "[DEBUG] Running local playwright bin..." -ForegroundColor DarkGray
     & $playwrightBin test --reporter=list --workers=1 --timeout=60000
   } else {
     Write-Host "[DEBUG] Running via npx playwright..." -ForegroundColor DarkGray
     & $npxCmd playwright test --reporter=list --workers=1 --timeout=60000
   }
 } catch {
   Write-Host "[ERROR] Playwright invocation failed: $($_.Exception.Message)" -ForegroundColor Red
   throw
 }
$code = $LASTEXITCODE
Pop-Location

Write-Host "Stopping dev server (PID=$($dev.Id)) ..." -ForegroundColor Yellow
try { Stop-Process -Id $dev.Id -Force } catch {}
Start-Sleep -Milliseconds 500

Write-Host "=== Last 80 lines of dev server stderr ===" -ForegroundColor Magenta
if (Test-Path $logErr) { Get-Content $logErr -Tail 80 } else { Write-Host "(no stderr log)" }
Write-Host "=== Last 80 lines of dev server stdout ===" -ForegroundColor Magenta
if (Test-Path $logOut) { Get-Content $logOut -Tail 80 } else { Write-Host "(no stdout log)" }

exit $code
