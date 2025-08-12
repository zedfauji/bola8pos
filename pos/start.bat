@echo off
echo Starting Bola8 Billiards POS System...
echo.

echo Installing Backend Dependencies...
cd backend
call npm install --only=prod
if %errorlevel% neq 0 (
    echo Error installing backend dependencies
    pause
    exit /b 1
)

echo.
echo Installing Frontend Dependencies...
cd ..\frontend
call npm install
if %errorlevel% neq 0 (
    echo Error installing frontend dependencies
    pause
    exit /b 1
)

echo.
echo Starting Backend Server...
cd ..\backend
start "Backend Server" cmd /k "npm run dev"

echo.
echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak > nul

echo Starting Frontend...
cd ..\frontend
start "Frontend Server" cmd /k "npm run dev"

echo.
echo Both servers are starting...
echo Backend: http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit...
pause > nul
