#!/usr/bin/env pwsh
# Test script for reservations API debugging
# Usage: .\test-reservations-api.ps1

param(
    [string]$BackendUrl = "http://localhost:3001",
    [int]$TimeoutSeconds = 30
)

Write-Host "🧪 Testing Reservations API..." -ForegroundColor Cyan
Write-Host "Backend URL: $BackendUrl" -ForegroundColor Gray

# Test 1: Basic health check
Write-Host "`n1️⃣ Testing basic backend connectivity..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BackendUrl/health" -Method GET -TimeoutSec $TimeoutSeconds -ErrorAction Stop
    Write-Host "✅ Backend health check passed" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend health check failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Make sure backend is running on port 3001" -ForegroundColor Gray
    exit 1
}

# Test 2: Test reservations endpoint without parameters
Write-Host "`n2️⃣ Testing /api/reservations (no params)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BackendUrl/api/reservations" -Method GET -TimeoutSec $TimeoutSeconds -ErrorAction Stop
    Write-Host "✅ Basic reservations endpoint works" -ForegroundColor Green
    Write-Host "   Returned $($response.reservations.Count) reservations" -ForegroundColor Gray
} catch {
    Write-Host "❌ Basic reservations endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   HTTP Status: $statusCode" -ForegroundColor Gray
        
        # Try to get error details
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "   Error body: $errorBody" -ForegroundColor Gray
        } catch {
            Write-Host "   Could not read error details" -ForegroundColor Gray
        }
    }
}

# Test 3: Test reservations endpoint with date parameter (the failing case)
Write-Host "`n3️⃣ Testing /api/reservations with date parameter..." -ForegroundColor Yellow
$testDate = "2025-08-13"
try {
    $response = Invoke-RestMethod -Uri "$BackendUrl/api/reservations?date=$testDate" -Method GET -TimeoutSec $TimeoutSeconds -ErrorAction Stop
    Write-Host "✅ Reservations with date parameter works" -ForegroundColor Green
    Write-Host "   Returned $($response.reservations.Count) reservations for $testDate" -ForegroundColor Gray
} catch {
    Write-Host "❌ Reservations with date parameter failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   HTTP Status: $statusCode" -ForegroundColor Gray
        
        # Try to get error details
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "   Error body: $errorBody" -ForegroundColor Gray
        } catch {
            Write-Host "   Could not read error details" -ForegroundColor Gray
        }
    }
}

# Test 4: Test hardware devices endpoint
Write-Host "`n4️⃣ Testing /api/hardware/devices..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BackendUrl/api/hardware/devices" -Method GET -TimeoutSec $TimeoutSeconds -ErrorAction Stop
    Write-Host "✅ Hardware devices endpoint works" -ForegroundColor Green
    Write-Host "   Returned $($response.devices.Count) devices" -ForegroundColor Gray
} catch {
    Write-Host "❌ Hardware devices endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Create a test reservation
Write-Host "`n5️⃣ Testing reservation creation..." -ForegroundColor Yellow
$testReservation = @{
    customer_name = "Test Customer"
    customer_phone = "555-1234"
    table_id = "B1"
    party_size = 4
    reservation_date = $testDate
    start_time = "14:00"
    end_time = "16:00"
    special_requests = "Test reservation from PowerShell"
    deposit_amount = 25.00
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BackendUrl/api/reservations" -Method POST -Body $testReservation -ContentType "application/json" -TimeoutSec $TimeoutSeconds -ErrorAction Stop
    Write-Host "✅ Reservation creation works" -ForegroundColor Green
    Write-Host "   Created reservation ID: $($response.id)" -ForegroundColor Gray
    
    # Clean up - delete the test reservation
    try {
        Invoke-RestMethod -Uri "$BackendUrl/api/reservations/$($response.id)" -Method DELETE -TimeoutSec $TimeoutSeconds -ErrorAction SilentlyContinue
        Write-Host "   Cleaned up test reservation" -ForegroundColor Gray
    } catch {
        Write-Host "   Note: Could not clean up test reservation" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Reservation creation failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🏁 Test completed!" -ForegroundColor Cyan
