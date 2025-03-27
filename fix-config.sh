#!/bin/bash

# =============================================
# BILLIARD POS CONFIG FIX SCRIPT
# Fixes "Cannot find module '../../config/config.js'"
# =============================================

# Navigate to backend directory
cd billiard-pos/backend || { echo "Backend directory not found"; exit 1; }

# 1. Create the missing config directory and file
mkdir -p config
cat > config/config.js <<'EOL'
module.exports = {
  development: {
    username: process.env.DB_USER || 'posuser',
    password: process.env.DB_PASSWORD || 'pospassword',
    database: process.env.DB_NAME || 'billiardpos',
    host: process.env.DB_HOST || 'postgres',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log
  },
  test: {
    username: 'posuser',
    password: 'pospassword',
    database: 'billiardpos_test',
    host: 'postgres',
    dialect: 'postgres'
  },
  production: {
    username: 'posuser',
    password: 'pospassword',
    database: 'billiardpos_prod',
    host: 'postgres',
    dialect: 'postgres'
  }
};
EOL

# 2. Fix the models/index.js file
cat > src/models/index.js <<'EOL'
const { Sequelize } = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require('../../config/config.js')[env];
const { Employee } = require('./employee.model');

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    logging: config.logging
  }
);

const db = {
  Employee: Employee(sequelize, Sequelize.DataTypes),
  sequelize,
  Sequelize
};

module.exports = db;
EOL

# 3. Update environment variables
cat >> .env <<'EOL'
DB_HOST=postgres
DB_PORT=5432
DB_USER=posuser
DB_PASSWORD=pospassword
DB_NAME=billiardpos
JWT_SECRET=$(openssl rand -hex 32)
EOL

# 4. Rebuild the Docker containers
cd ..
docker-compose down
docker-compose build backend
docker-compose up -d

echo "============================================"
echo "CONFIGURATION FIX APPLIED SUCCESSFULLY!"
echo "============================================"
echo "1. Created config/config.js with database settings"
echo "2. Updated models/index.js with proper paths"
echo "3. Added required environment variables"
echo ""
echo "Your backend should now start without errors."
echo "Check logs with: docker-compose logs -f backend"
echo "============================================"