$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$BASE = 'https://localhost:3001'

function Invoke-LocalApi {
    param(
        [Parameter(Mandatory=$false)][ValidateSet('Get','Post','Put','Patch','Delete')][string]$Method = 'Get',
        [Parameter(Mandatory=$true)][string]$Uri,
        [Parameter(Mandatory=$false)][object]$Body,
        [Parameter(Mandatory=$false)][hashtable]$Headers
    )
    if ($PSVersionTable.PSVersion.Major -ge 7) {
        # PowerShell 7+: use -SkipCertificateCheck
        if ($null -ne $Body) {
            return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType 'application/json' -Body ($Body | ConvertTo-Json) -SkipCertificateCheck
        } else {
            return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -SkipCertificateCheck
        }
    } else {
        # Windows PowerShell 5.x: use curl.exe -k fallback
        $curlArgs = @('-k','-s')
        if ($Headers) {
            foreach ($k in $Headers.Keys) { $curlArgs += @('-H',"$($k): $($Headers[$k])") }
        }
        if ($Method -in @('Post','Put','Patch')) {
            $json = ($Body | ConvertTo-Json)
            $curlArgs += @('-H','Content-Type: application/json','-X',$Method,'-d',$json,$Uri)
        } elseif ($Method -eq 'Delete') {
            $curlArgs += @('-X','DELETE',$Uri)
        } else {
            $curlArgs += @($Uri)
        }
        $resp = & curl.exe @curlArgs
        try { return $resp | ConvertFrom-Json } catch { return $resp }
    }
}

Write-Host "Logging in to $BASE ..."
$login = Invoke-LocalApi -Method Post -Uri "$BASE/api/access/auth/login" -Body @{ email = 'admin@billiardpos.com'; password = 'password' }
if (-not $login -or -not $login.token) { throw "Login failed: $($login | ConvertTo-Json -Depth 5 -Compress)" }
$token = $login.token
Write-Host "Login OK. Token: $($token -replace '^(.{30}).+(.{30})$', '$1...$2')"

# Decode token to verify permissions
$tokenParts = $token.Split('.')
if ($tokenParts.Count -eq 3) {
    $payload = $tokenParts[1].Replace('-', '+').Replace('_', '/')
    $mod = $payload.Length % 4
    if ($mod -gt 0) { $payload += '=' * (4 - $mod) }
    $json = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payload))
    Write-Host "Token payload: $json"
}

$headers = @{ 
    Authorization = "Bearer $token"
    'Content-Type' = 'application/json'
}

Write-Host "GET /api/table-layouts"
$layouts = Invoke-LocalApi -Method Get -Uri "$BASE/api/table-layouts" -Headers $headers
if ($layouts -is [System.Array] -or $layouts -is [System.Collections.IEnumerable]) { Write-Host ("Layouts count: " + (($layouts | Measure-Object).Count)) } else { $layouts | ConvertTo-Json -Depth 6 }

Write-Host "GET /api/table-layouts/active"
$active = Invoke-LocalApi -Method Get -Uri "$BASE/api/table-layouts/active" -Headers $headers
Write-Host ("Active layout present: " + [bool]$active)

Write-Host "GET /api/tables"
$tables = Invoke-LocalApi -Method Get -Uri "$BASE/api/tables" -Headers $headers
if ($tables -is [System.Array] -or $tables -is [System.Collections.IEnumerable]) { Write-Host ("Tables count: " + (($tables | Measure-Object).Count)) } else { $tables | ConvertTo-Json -Depth 6 }
