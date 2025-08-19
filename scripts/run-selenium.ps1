param(
  [int]$TimeoutSeconds = 180,
  [string]$FrontendPath = "C:\\Users\\giris\\Documents\\Code\\POS\\pos\\frontend",
  [string]$JestArgs = ""
)

$ErrorActionPreference = 'Stop'

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logDir = Join-Path $FrontendPath "test-results\\selenium-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$outLog = Join-Path $logDir "jest-selenium-$timestamp.out.log"
$errLog = Join-Path $logDir "jest-selenium-$timestamp.err.log"

Write-Host "Starting Selenium Jest with timeout $TimeoutSeconds seconds..."

$psi = New-Object System.Diagnostics.ProcessStartInfo
# Use cmd.exe to ensure npm.cmd resolution on Windows
$psi.FileName = $env:ComSpec
$psi.Arguments = "/c npm.cmd run test:selenium"
if ($JestArgs -and $JestArgs.Trim().Length -gt 0) {
  $psi.Arguments += " -- $JestArgs"
}
$psi.WorkingDirectory = $FrontendPath
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $psi
$null = $process.Start()

# Async log redirection
$stdOutWriter = [System.IO.StreamWriter]::new($outLog, $true)
$stdErrWriter = [System.IO.StreamWriter]::new($errLog, $true)

$stdoutTask = $process.StandardOutput.BaseStream.CopyToAsync($stdOutWriter.BaseStream)
$stderrTask = $process.StandardError.BaseStream.CopyToAsync($stdErrWriter.BaseStream)

# Wait with timeout
$exited = $process.WaitForExit($TimeoutSeconds * 1000)

# Ensure logs are flushed
$stdoutTask.Wait(3000) | Out-Null
$stderrTask.Wait(3000) | Out-Null
$stdOutWriter.Flush(); $stdErrWriter.Flush();
$stdOutWriter.Dispose(); $stdErrWriter.Dispose();

if (-not $exited) {
  Write-Warning "Selenium tests exceeded ${TimeoutSeconds}s. Killing process (PID=$($process.Id))..."
  try {
    $process.Kill($true)
  } catch {}
  Write-Host "Logs: `n  OUT: $outLog`n  ERR: $errLog"
  exit 124
}

$exitCode = $process.ExitCode
Write-Host "Selenium tests finished with exit code $exitCode"
Write-Host "Logs: `n  OUT: $outLog`n  ERR: $errLog"
exit $exitCode
