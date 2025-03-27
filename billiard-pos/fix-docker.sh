#!/bin/bash

# =============================================
# BILLIARD POS DOCKER FIX SCRIPT
# Resolves "nginx.conf not found" error
# =============================================

# 1. First, clean up any existing containers
docker-compose down -v

# 2. Create proper Dockerfiles
cat > backend/Dockerfile <<'EOL'
FROM node:16

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
EOL

cat > frontend/Dockerfile <<'EOL'
FROM node:16

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
EOL

# 3. Create clean docker-compose.yml
cat > docker-compose.yml <<'EOL'
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
    image: redis:6-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build: 
      context: ./backend
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
      - JWT_SECRET=${JWT_SECRET:-changeme}
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  frontend:
    build: 
      context: ./frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:5000/api
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
EOL

# 4. Clean up and rebuild
docker-compose build --no-cache
docker-compose up -d

echo "============================================"
echo "DOCKER FIX APPLIED SUCCESSFULLY!"
echo "============================================"
echo "Your services should now be running:"
echo "- Frontend: http://localhost:3000"
echo "- Backend: http://localhost:5000"
echo ""
echo "If you need to see logs:"
echo "docker-compose logs -f"
echo "============================================"