# Create .env file in backend directory
$envContent = @"
PORT=3001
NODE_ENV=development
USE_FIRESTORE=false
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=bola8pos
JWT_SECRET=your_jwt_secret_here
"@

# Write to .env file
$envContent | Out-File -FilePath "c:\Users\giris\Documents\Code\POS\pos\backend\.env" -Force

Write-Host "Environment file created successfully at c:\Users\giris\Documents\Code\POS\pos\backend\.env"
