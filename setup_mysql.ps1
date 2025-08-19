# MySQL connection parameters
$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
$mysqlUser = "root"
$mysqlPassword = "password"  # Replace with your MySQL root password
$databaseName = "bola8pos"

# SQL commands to create database and user
$sqlCommands = @"
CREATE DATABASE IF NOT EXISTS `$databaseName`;
CREATE USER IF NOT EXISTS 'bola8pos'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON `$databaseName`.* TO 'bola8pos'@'localhost';
FLUSH PRIVILEGES;
"@

# Execute MySQL commands
& $mysqlPath -u $mysqlUser -p$mysqlPassword -e "$sqlCommands"

Write-Host "Database setup completed successfully!"
