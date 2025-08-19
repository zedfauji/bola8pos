param (
    [Parameter(Position=0)]
    [string]$Feature = "all"
)

$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$frontendDir = Join-Path -Path $rootDir -ChildPath "pos\frontend"
$backendDir = Join-Path -Path $rootDir -ChildPath "pos\backend"

function Show-Header {
    param (
        [string]$Title
    )
    
    Write-Host ""
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host " $Title" -ForegroundColor Cyan
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
}

function Show-Help {
    Show-Header "POS System Feature Verification"
    
    Write-Host "Usage: .\verify-features.ps1 [feature]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Features:" -ForegroundColor Green
    Write-Host "  all           - Verify all features (default)"
    Write-Host "  login         - Verify login and authentication"
    Write-Host "  rbac          - Verify role-based access control"
    Write-Host "  inventory     - Verify inventory subsystem dashboards"
    Write-Host "  tables        - Verify table management subsystem dashboards"
    Write-Host "  api           - Verify API endpoints and error handling"
    Write-Host "  health        - Verify backend health endpoint"
    Write-Host "  manager-pin   - Verify manager PIN enforcement"
    Write-Host "  help          - Show this help message"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\verify-features.ps1 login"
    Write-Host "  .\verify-features.ps1 inventory"
}

function Verify-Login {
    Show-Header "Verifying Login and Authentication"
    
    Write-Host "1. Testing login endpoint..." -ForegroundColor Yellow
    $loginUrl = "http://localhost:3001/api/access/auth/login"
    $loginBody = @{
        email = "admin@billiardpos.com"
        password = "admin123"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri $loginUrl -Method Post -Body $loginBody -ContentType "application/json" -ErrorAction Stop
        Write-Host "✓ Login endpoint working" -ForegroundColor Green
        Write-Host "  - Access token received: $($response.accessToken.Substring(0, 20))..." -ForegroundColor Green
    }
    catch {
        Write-Host "✗ Login endpoint failed: $_" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "2. Testing token refresh..." -ForegroundColor Yellow
    $refreshUrl = "http://localhost:3001/api/access/auth/refresh"
    
    try {
        $response = Invoke-RestMethod -Uri $refreshUrl -Method Post -ErrorAction Stop
        Write-Host "✓ Token refresh endpoint working" -ForegroundColor Green
    }
    catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 401) {
            Write-Host "✓ Token refresh endpoint working (unauthorized as expected without valid refresh token)" -ForegroundColor Green
        }
        else {
            Write-Host "✗ Token refresh endpoint failed: $_" -ForegroundColor Red
        }
    }
}

function Verify-RBAC {
    Show-Header "Verifying Role-Based Access Control"
    
    Write-Host "1. Checking frontend route guards..." -ForegroundColor Yellow
    $protectedRoutePath = Join-Path -Path $frontendDir -ChildPath "src\components\ProtectedRoute.jsx"
    
    if (Test-Path $protectedRoutePath) {
        $protectedRouteContent = Get-Content $protectedRoutePath -Raw
        if ($protectedRouteContent -match "allowedRoles" -and $protectedRouteContent -match "requiredPermission") {
            Write-Host "✓ ProtectedRoute component has role and permission checks" -ForegroundColor Green
        }
        else {
            Write-Host "✗ ProtectedRoute component missing role or permission checks" -ForegroundColor Red
        }
    }
    else {
        Write-Host "✗ ProtectedRoute component not found" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "2. Checking backend role middleware..." -ForegroundColor Yellow
    $authMiddlewarePath = Join-Path -Path $backendDir -ChildPath "src\middleware\auth.middleware.js"
    
    if (Test-Path $authMiddlewarePath) {
        $authMiddlewareContent = Get-Content $authMiddlewarePath -Raw
        if ($authMiddlewareContent -match "hasRole" -and $authMiddlewareContent -match "checkPermission") {
            Write-Host "✓ Backend has role and permission middleware" -ForegroundColor Green
        }
        else {
            Write-Host "✗ Backend missing role or permission middleware" -ForegroundColor Red
        }
        
        if ($authMiddlewareContent -match "requireManagerPin") {
            Write-Host "✓ Backend has manager PIN enforcement" -ForegroundColor Green
        }
        else {
            Write-Host "✗ Backend missing manager PIN enforcement" -ForegroundColor Red
        }
    }
    else {
        Write-Host "✗ Auth middleware not found" -ForegroundColor Red
    }
}

function Verify-Inventory {
    Show-Header "Verifying Inventory Subsystem Dashboards"
    
    Write-Host "1. Checking inventory route component..." -ForegroundColor Yellow
    $inventoryRoutePath = Join-Path -Path $frontendDir -ChildPath "src\routes\Inventory.jsx"
    
    if (Test-Path $inventoryRoutePath) {
        $inventoryRouteContent = Get-Content $inventoryRoutePath -Raw
        if ($inventoryRouteContent -match "AdminDashboard" -and $inventoryRouteContent -match "EmployeeDashboard") {
            Write-Host "✓ Inventory route has role-based dashboards" -ForegroundColor Green
        }
        else {
            Write-Host "✗ Inventory route missing role-based dashboards" -ForegroundColor Red
        }
    }
    else {
        Write-Host "✗ Inventory route component not found" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "2. Checking employee dashboard..." -ForegroundColor Yellow
    $employeeDashboardPath = Join-Path -Path $frontendDir -ChildPath "src\pages\inventory\EmployeeDashboard.jsx"
    
    if (Test-Path $employeeDashboardPath) {
        $employeeDashboardContent = Get-Content $employeeDashboardPath -Raw
        if ($employeeDashboardContent -match "LowStockWidget" -and $employeeDashboardContent -match "RecentMovementsWidget") {
            Write-Host "✓ Employee dashboard has required widgets" -ForegroundColor Green
        }
        else {
            Write-Host "✗ Employee dashboard missing required widgets" -ForegroundColor Red
        }
    }
    else {
        Write-Host "✗ Employee dashboard not found" -ForegroundColor Red
    }
}

function Verify-Tables {
    Show-Header "Verifying Table Management Subsystem Dashboards"
    
    Write-Host "1. Checking tables route component..." -ForegroundColor Yellow
    $tablesRoutePath = Join-Path -Path $frontendDir -ChildPath "src\routes\Tables.jsx"
    
    if (Test-Path $tablesRoutePath) {
        $tablesRouteContent = Get-Content $tablesRoutePath -Raw
        if ($tablesRouteContent -match "AdminDashboard" -and $tablesRouteContent -match "EmployeeDashboard") {
            Write-Host "✓ Tables route has role-based dashboards" -ForegroundColor Green
        }
        else {
            Write-Host "✗ Tables route missing role-based dashboards" -ForegroundColor Red
        }
    }
    else {
        Write-Host "✗ Tables route component not found" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "2. Checking employee dashboard..." -ForegroundColor Yellow
    $employeeDashboardPath = Join-Path -Path $frontendDir -ChildPath "src\pages\tables\EmployeeDashboard.jsx"
    
    if (Test-Path $employeeDashboardPath) {
        $employeeDashboardContent = Get-Content $employeeDashboardPath -Raw
        if ($employeeDashboardContent -match "TableStatusWidget" -and $employeeDashboardContent -match "ReservationsWidget") {
            Write-Host "✓ Employee dashboard has required widgets" -ForegroundColor Green
        }
        else {
            Write-Host "✗ Employee dashboard missing required widgets" -ForegroundColor Red
        }
    }
    else {
        Write-Host "✗ Employee dashboard not found" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "3. Checking admin dashboard..." -ForegroundColor Yellow
    $adminDashboardPath = Join-Path -Path $frontendDir -ChildPath "src\pages\tables\AdminDashboard.jsx"
    
    if (Test-Path $adminDashboardPath) {
        $adminDashboardContent = Get-Content $adminDashboardPath -Raw
        if ($adminDashboardContent -match "TableStatusSummaryWidget" -and $adminDashboardContent -match "FloorOccupancyWidget") {
            Write-Host "✓ Admin dashboard has required widgets" -ForegroundColor Green
        }
        else {
            Write-Host "✗ Admin dashboard missing required widgets" -ForegroundColor Red
        }
    }
    else {
        Write-Host "✗ Admin dashboard not found" -ForegroundColor Red
    }
}

function Verify-API {
    Show-Header "Verifying API Endpoints and Error Handling"
    
    Write-Host "1. Testing API error handling..." -ForegroundColor Yellow
    $apiErrorHandlerPath = Join-Path -Path $frontendDir -ChildPath "src\utils\apiErrorHandler.ts"
    
    if (Test-Path $apiErrorHandlerPath) {
        $apiErrorHandlerContent = Get-Content $apiErrorHandlerPath -Raw
        if ($apiErrorHandlerContent -match "handleApiError" -and $apiErrorHandlerContent -match "createSafeApiCall") {
            Write-Host "✓ API error handling utilities found" -ForegroundColor Green
        }
        else {
            Write-Host "✗ API error handling utilities incomplete" -ForegroundColor Red
        }
    }
    else {
        Write-Host "✗ API error handling utilities not found" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "2. Testing API client..." -ForegroundColor Yellow
    $apiClientPath = Join-Path -Path $frontendDir -ChildPath "src\utils\apiClient.ts"
    
    if (Test-Path $apiClientPath) {
        $apiClientContent = Get-Content $apiClientPath -Raw
        if ($apiClientContent -match "baseURL" -and $apiClientContent -match "interceptors") {
            Write-Host "✓ API client with interceptors found" -ForegroundColor Green
        }
        else {
            Write-Host "✗ API client missing interceptors" -ForegroundColor Red
        }
    }
    else {
        Write-Host "✗ API client not found" -ForegroundColor Red
    }
}

function Verify-Health {
    Show-Header "Verifying Backend Health Endpoint"
    
    Write-Host "Testing health endpoint..." -ForegroundColor Yellow
    $healthUrl = "http://localhost:3001/api/health"
    
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -Method Get -ErrorAction Stop
        Write-Host "✓ Health endpoint working" -ForegroundColor Green
        Write-Host "  - Status: $($response.status)" -ForegroundColor Green
        Write-Host "  - Uptime: $($response.uptime) seconds" -ForegroundColor Green
        Write-Host "  - Environment: $($response.environment)" -ForegroundColor Green
    }
    catch {
        Write-Host "✗ Health endpoint failed: $_" -ForegroundColor Red
    }
}

function Verify-ManagerPin {
    Show-Header "Verifying Manager PIN Enforcement"
    
    Write-Host "Checking manager PIN middleware..." -ForegroundColor Yellow
    $authMiddlewarePath = Join-Path -Path $backendDir -ChildPath "src\middleware\auth.middleware.js"
    
    if (Test-Path $authMiddlewarePath) {
        $authMiddlewareContent = Get-Content $authMiddlewarePath -Raw
        if ($authMiddlewareContent -match "requireManagerPin") {
            Write-Host "✓ Manager PIN middleware found" -ForegroundColor Green
            
            if ($authMiddlewareContent -match "managerPin" -and $authMiddlewareContent -match "storedPin") {
                Write-Host "✓ Manager PIN validation logic found" -ForegroundColor Green
            }
            else {
                Write-Host "✗ Manager PIN validation logic incomplete" -ForegroundColor Red
            }
        }
        else {
            Write-Host "✗ Manager PIN middleware not found" -ForegroundColor Red
        }
    }
    else {
        Write-Host "✗ Auth middleware not found" -ForegroundColor Red
    }
}

function Verify-All {
    Verify-Login
    Verify-RBAC
    Verify-Inventory
    Verify-Tables
    Verify-API
    Verify-Health
    Verify-ManagerPin
    
    Show-Header "Verification Summary"
    Write-Host "All verification checks completed." -ForegroundColor Cyan
    Write-Host "Please review any warnings or errors above." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To start the application with PM2, run:" -ForegroundColor Yellow
    Write-Host "  .\manage-pm2.ps1 start" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To check logs (with --nostream flag):" -ForegroundColor Yellow
    Write-Host "  .\manage-pm2.ps1 logs" -ForegroundColor Yellow
}

# Main execution
switch ($Feature) {
    "login" { Verify-Login }
    "rbac" { Verify-RBAC }
    "inventory" { Verify-Inventory }
    "tables" { Verify-Tables }
    "api" { Verify-API }
    "health" { Verify-Health }
    "manager-pin" { Verify-ManagerPin }
    "all" { Verify-All }
    default { Show-Help }
}
