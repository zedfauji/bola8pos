# Test Login and Tables API

# Configuration
$baseUrl = "https://localhost:3001/api"
$loginEndpoint = "$baseUrl/auth/login"
$tablesEndpoint = "$baseUrl/tables"

# Skip SSL certificate validation (for self-signed certs) - PowerShell 4.0+ compatible
Add-Type -TypeDefinition @"
    using System.Net;
    using System.Security.Cryptography.X509Certificates;
    public class TrustAllCertsPolicy : ICertificatePolicy {
        public bool CheckValidationResult(
            ServicePoint srvPoint, X509Certificate certificate,
            WebRequest request, int certificateProblem) {
            return true;
        }
    }
"@
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy

# Login request
$loginBody = @{
    email = "admin@billiardpos.com"
    password = "password"
} | ConvertTo-Json

try {
    Write-Host "Attempting to login..." -ForegroundColor Cyan
    
    # Login and get tokens
    $loginResponse = Invoke-RestMethod -Uri $loginEndpoint `
        -Method Post `
        -Body $loginBody `
        -ContentType "application/json"

    $accessToken = $loginResponse.accessToken
    $user = $loginResponse.user
    
    Write-Host "Login successful!" -ForegroundColor Green
    Write-Host "User: $($user.name) ($($user.email))"
    Write-Host "Role: $($user.role_name)"
    
    # Make authenticated request to tables endpoint
    Write-Host "`nFetching tables..." -ForegroundColor Cyan
    
    $tablesResponse = Invoke-RestMethod -Uri $tablesEndpoint `
        -Method Get `
        -Headers @{
            "Authorization" = "Bearer $accessToken"
            "Content-Type" = "application/json"
        }
    
    Write-Host "Tables retrieved successfully!" -ForegroundColor Green
    Write-Host "Number of tables: $($tablesResponse.Count)"
    $tablesResponse | Format-Table -Property id, name, status, capacity -AutoSize
    
} catch {
    Write-Host "`nError occurred: " -ForegroundColor Red -NoNewline
    Write-Host $_.Exception.Message
    
    if ($_.ErrorDetails) {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Error details: $($errorDetails | ConvertTo-Json -Depth 5)" -ForegroundColor Red
    }
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $statusDescription = $_.Exception.Response.StatusDescription
        Write-Host "Status: $statusCode $statusDescription" -ForegroundColor Red
        
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        
        if ($responseBody) {
            try {
                $responseJson = $responseBody | ConvertFrom-Json
                Write-Host "Response: $($responseJson | ConvertTo-Json -Depth 5)" -ForegroundColor Red
            } catch {
                Write-Host "Response: $responseBody" -ForegroundColor Red
            }
        }
    }
}
