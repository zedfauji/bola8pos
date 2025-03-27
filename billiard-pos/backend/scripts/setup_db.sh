#!/bin/bash

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Installing now..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi

# Create database and user
sudo -u postgres psql <<EOF
CREATE USER posuser WITH PASSWORD 'pospassword';
CREATE DATABASE billiardpos;
GRANT ALL PRIVILEGES ON DATABASE billiardpos TO posuser;
ALTER DATABASE billiardpos OWNER TO posuser;
EOF

echo "Database 'billiardpos' and user 'posuser' created successfully!"
