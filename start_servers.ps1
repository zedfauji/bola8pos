# Start backend server
$backendProcess = Start-Process -FilePath "node" -ArgumentList "src/server.js" -WorkingDirectory "c:\Users\giris\Documents\Code\POS\pos\backend" -PassThru -NoNewWindow

# Wait a moment for backend to start
Start-Sleep -Seconds 5

# Start frontend server
$frontendProcess = Start-Process -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory "c:\Users\giris\Documents\Code\POS\pos\frontend" -PassThru -NoNewWindow

# Open browser after a short delay
Start-Sleep -Seconds 10
Start-Process "http://localhost:5173"

Write-Host "Servers are starting..."
Write-Host "- Backend: http://localhost:3001"
Write-Host "- Frontend: http://localhost:5173"
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers"

# Keep the script running until user presses Ctrl+C
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    # Cleanup on exit
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
}
