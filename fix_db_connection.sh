#!/bin/bash

# 1. First, let's update the database configuration
cat > billiard-pos/backend/src/config/database.js <<'EOL'
require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'posuser',
    password: process.env.DB_PASSWORD || 'pospassword',
    database: process.env.DB_NAME || 'billiardpos',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      connectTimeout: 60000
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: `${process.env.DB_NAME}_test`,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres'
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false
  }
};
EOL

# 2. Update the server.js with better connection handling
cat > billiard-pos/backend/src/server.js <<'EOL'
require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const redisClient = require('./config/redis');

const PORT = process.env.PORT || 5000;

// Database connection with retry logic
const connectWithRetry = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected...');
    
    // Sync models
    await sequelize.sync({ alter: true });
    console.log('Models synchronized...');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Connection error:', err.message);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  }
};

// Redis connection
redisClient.on('connect', () => console.log('Redis connected...'));
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Start the connection process
connectWithRetry();
EOL

# 3. Create a database setup script
cat > billiard-pos/backend/scripts/setup_db.sh <<'EOL'
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
EOL

# 4. Make the setup script executable
chmod +x billiard-pos/backend/scripts/setup_db.sh

# 5. Create a docker-compose file for local development
cat > billiard-pos/docker-compose.yml <<'EOL'
version: '3.8'

services:
  postgres:
    image: postgres:13
    environment:
      POSTGRES_USER: posuser
      POSTGRES_PASSWORD: pospassword
      POSTGRES_DB: billiardpos
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U posuser -d billiardpos"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:6
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=development
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=posuser
      - DB_PASSWORD=pospassword
      - DB_NAME=billiardpos
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./backend:/app
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
EOL

# 6. Update the README with setup instructions
cat > billiard-pos/backend/README.md <<'EOL'
# Billiard POS Backend Setup

## Prerequisites
- Docker and Docker Compose
- Node.js 16+

## Setup Instructions

### Option 1: Using Docker (Recommended)
1. Start the services:
   ```bash
   docker-compose up -d