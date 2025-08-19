#!/usr/bin/env pwsh
# Test script for database schema debugging
# Usage: .\test-db-schema.ps1

param(
    [string]$BackendUrl = "http://localhost:3001"
)

Write-Host "🔍 Testing Database Schema..." -ForegroundColor Cyan

# Test 1: Check if reservations table exists
Write-Host "`n1️⃣ Testing database tables..." -ForegroundColor Yellow
try {
    # Create a simple test endpoint call that might reveal table structure
    $testQuery = @{
        query = "SHOW TABLES LIKE 'reservations'"
    } | ConvertTo-Json

    # Try a direct SQL test via a custom endpoint (if available)
    Write-Host "   Checking reservations table existence..." -ForegroundColor Gray
    
    # Alternative: Test with minimal parameters
    $response = Invoke-WebRequest -Uri "$BackendUrl/api/reservations?limit=1" -Method GET -UseBasicParsing
    Write-Host "   Response status: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Response body: $($response.Content)" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Database table test failed: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   HTTP Status: $statusCode" -ForegroundColor Gray
        
        # Get response body for 500 errors
        if ($statusCode -eq 500) {
            try {
                $responseStream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($responseStream)
                $responseBody = $reader.ReadToEnd()
                Write-Host "   Error details: $responseBody" -ForegroundColor Red
            } catch {
                Write-Host "   Could not read error response" -ForegroundColor Gray
            }
        }
    }
}

# Test 2: Check customers table (referenced in reservations query)
Write-Host "`n2️⃣ Testing customers table..." -ForegroundColor Yellow
try {
    # Test a simple endpoint that might use customers
    $response = Invoke-RestMethod -Uri "$BackendUrl/api/customers" -Method GET -ErrorAction Stop
    Write-Host "✅ Customers table accessible" -ForegroundColor Green
    Write-Host "   Found $($response.customers.Count) customers" -ForegroundColor Gray
} catch {
    Write-Host "❌ Customers table test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Test hardware table (working endpoint for comparison)
Write-Host "`n3️⃣ Testing hardware_devices table..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BackendUrl/api/hardware/devices" -Method GET -ErrorAction Stop
    Write-Host "✅ Hardware devices table accessible" -ForegroundColor Green
    Write-Host "   Found $($response.devices.Count) devices" -ForegroundColor Gray
} catch {
    Write-Host "❌ Hardware devices test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🏁 Schema test completed!" -ForegroundColor Cyan
