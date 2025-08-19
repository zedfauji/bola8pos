#!/usr/bin/env pwsh
# Restart backend and test reservations API
# Usage: .\restart-and-test-backend.ps1

param(
    [string]$BackendPath = "c:\Users\giris\Documents\Code\POS\pos\backend",
    [string]$BackendUrl = "http://localhost:3001",
    [int]$WaitSeconds = 10
)

Write-Host "🔄 Restarting Backend and Testing..." -ForegroundColor Cyan

# Step 1: Stop existing backend processes
Write-Host "`n1️⃣ Stopping existing backend processes..." -ForegroundColor Yellow
try {
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq "" } | Stop-Process -Force
    Write-Host "✅ Stopped existing node processes" -ForegroundColor Green
    Start-Sleep -Seconds 2
} catch {
    Write-Host "⚠️ No existing processes to stop" -ForegroundColor Yellow
}

# Step 2: Start backend
Write-Host "`n2️⃣ Starting backend server..." -ForegroundColor Yellow
try {
    $backendJob = Start-Job -ScriptBlock {
        param($path)
        Set-Location $path
        npm start
    } -ArgumentList $BackendPath
    
    Write-Host "✅ Backend job started (ID: $($backendJob.Id))" -ForegroundColor Green
    Write-Host "   Waiting $WaitSeconds seconds for startup..." -ForegroundColor Gray
    Start-Sleep -Seconds $WaitSeconds
    
} catch {
    Write-Host "❌ Failed to start backend: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Test backend health
Write-Host "`n3️⃣ Testing backend health..." -ForegroundColor Yellow
$healthRetries = 5
$healthOk = $false

for ($i = 1; $i -le $healthRetries; $i++) {
    try {
        $response = Invoke-RestMethod -Uri "$BackendUrl/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✅ Backend health check passed (attempt $i)" -ForegroundColor Green
        $healthOk = $true
        break
    } catch {
        Write-Host "⚠️ Health check failed (attempt $i): $($_.Exception.Message)" -ForegroundColor Yellow
        if ($i -lt $healthRetries) {
            Start-Sleep -Seconds 3
        }
    }
}

if (-not $healthOk) {
    Write-Host "❌ Backend failed to start properly" -ForegroundColor Red
    exit 1
}

# Step 4: Test reservations API
Write-Host "`n4️⃣ Testing reservations API..." -ForegroundColor Yellow

# Test basic endpoint
try {
    $response = Invoke-RestMethod -Uri "$BackendUrl/api/reservations" -Method GET -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ Basic reservations endpoint works" -ForegroundColor Green
    Write-Host "   Found $($response.reservations.Count) reservations" -ForegroundColor Gray
} catch {
    Write-Host "❌ Basic reservations endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test with date parameter
try {
    $testDate = "2025-08-13"
    $response = Invoke-RestMethod -Uri "$BackendUrl/api/reservations?date=$testDate" -Method GET -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ Reservations with date parameter works" -ForegroundColor Green
    Write-Host "   Found $($response.reservations.Count) reservations for $testDate" -ForegroundColor Gray
} catch {
    Write-Host "❌ Reservations with date parameter failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test reservation creation
Write-Host "`n5️⃣ Testing reservation creation..." -ForegroundColor Yellow

# Find a non-conflicting slot via availability endpoint
$createDate = "2025-08-13"
$tableId = "B1"
$duration = 120
$startTime = $null
$endTime = $null

try {
    $avail = Invoke-RestMethod -Uri "$BackendUrl/api/reservations/availability/$tableId?date=$createDate&duration=$duration" -Method GET -TimeoutSec 10 -ErrorAction Stop
    if (-not $avail.available_slots -or $avail.available_slots.Count -eq 0) {
        # Fallback to tomorrow if no slots on test date
        $createDate = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')
        $avail = Invoke-RestMethod -Uri "$BackendUrl/api/reservations/availability/$tableId?date=$createDate&duration=$duration" -Method GET -TimeoutSec 10 -ErrorAction Stop
    }
    if ($avail.available_slots -and $avail.available_slots.Count -gt 0) {
        $slot = $avail.available_slots | Select-Object -First 1
        $startTime = $slot.start_time
        $endTime = $slot.end_time
    }
} catch {
    Write-Host "   Note: Availability check failed, using default late slot" -ForegroundColor Gray
}

if (-not $startTime) {
    # Default to a late slot unlikely to collide
    $startTime = "21:00:00"
    $endTime = "23:00:00"
}

$testReservation = @{
    customer_name = "Test Customer PowerShell"
    customer_phone = "555-9999"
    customer_email = "test@example.com"
    table_id = $tableId
    party_size = 2
    reservation_date = $createDate
    start_time = $startTime
    end_time = $endTime
    special_requests = "Test from PowerShell script"
    deposit_amount = 20.00
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BackendUrl/api/reservations" -Method POST -Body $testReservation -ContentType "application/json" -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ Reservation creation works" -ForegroundColor Green
    Write-Host "   Created reservation: $($response.reservation_number)" -ForegroundColor Gray
    
    # Clean up test reservation
    if ($response.id) {
        try {
            Invoke-RestMethod -Uri "$BackendUrl/api/reservations/$($response.id)" -Method DELETE -TimeoutSec 5 -ErrorAction SilentlyContinue
            Write-Host "   Cleaned up test reservation" -ForegroundColor Gray
        } catch {
            Write-Host "   Note: Could not clean up test reservation" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Reservation creation failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "   Error details: $errorBody" -ForegroundColor Red
        } catch {
            Write-Host "   Could not read error details" -ForegroundColor Gray
        }
    }
}

Write-Host "`n🏁 Backend restart and test completed!" -ForegroundColor Cyan
Write-Host "Backend is running in background job ID: $($backendJob.Id)" -ForegroundColor Gray
Write-Host "To stop: Stop-Job $($backendJob.Id); Remove-Job $($backendJob.Id)" -ForegroundColor Gray
