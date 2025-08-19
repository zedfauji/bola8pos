#!/bin/bash

# Deployment script for Billiard POS Backend
# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh production

set -e  # Exit on error

ENV=${1:-production}
TIMESTAMP=$(date +%Y%m%d%H%M%S)
BACKUP_DIR="/var/backups/billiard-pos/$(date +%Y%m%d)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Starting deployment to ${ENV} environment...${NC}"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 is not installed. Please install it with 'npm install -g pm2'${NC}"
    exit 1
fi

# Create backup directory
mkdir -p "${BACKUP_DIR}"
echo -e "📦 Created backup directory: ${BACKUP_DIR}"

# Backup current deployment
if [ -d "/var/www/billiard-pos/current" ]; then
    echo -e "📂 Backing up current deployment..."
    cp -r /var/www/billiard-pos/current "${BACKUP_DIR}/billiard-pos-${TIMESTAMP}"
    echo -e "✅ Backup created at ${BACKUP_DIR}/billiard-pos-${TIMESTAMP}"
fi

# Pull latest changes
echo -e "🔄 Pulling latest changes..."
cd /var/www/billiard-pos

# If it's a git repository, pull the latest changes
if [ -d .git ]; then
    git fetch origin
    git reset --hard origin/main
else
    echo -e "${YELLOW}⚠️  Not a git repository. Skipping git pull.${NC}"
fi

# Install dependencies
echo -e "📦 Installing dependencies..."
npm ci --production

# Run database migrations
echo -e "🔄 Running database migrations..."
npm run migrate

# Restart the application
echo -e "🔄 Restarting application..."
pm2 reload ecosystem.config.js --env ${ENV}

# Save PM2 process list
pm2 save

# Set up log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true

echo -e "\n${GREEN}✅ Deployment to ${ENV} completed successfully!${NC}"
echo -e "📊 Check application status: ${YELLOW}pm2 status${NC}"
echo -e "📋 View logs: ${YELLOW}pm2 logs billiard-pos-backend${NC}"
