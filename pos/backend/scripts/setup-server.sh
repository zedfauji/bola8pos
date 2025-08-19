#!/bin/bash

# Server setup script for Billiard POS Backend
# Run this script on a fresh Ubuntu/Debian server

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Starting server setup for Billiard POS Backend...${NC}"

# Update package lists
echo -e "🔄 Updating package lists..."
sudo apt-get update

# Install required system packages
echo -e "📦 Installing system dependencies..."
sudo apt-get install -y \
    git \
    curl \
    wget \
    unzip \
    build-essential \
    python3 \
    python3-pip \
    mysql-client \
    mysql-server \
    nginx \
    certbot \
    python3-certbot-nginx

# Install Node.js 18.x
echo -e "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
echo -e "📦 Installing PM2 process manager..."
sudo npm install -g pm2

# Install MySQL if not already installed
if ! command -v mysql &> /dev/null; then
    echo -e "📦 Installing MySQL server..."
    sudo apt-get install -y mysql-server
    sudo systemctl start mysql
    sudo systemctl enable mysql
    
    # Run MySQL secure installation
    echo -e "${YELLOW}⚠️  Please complete MySQL secure installation...${NC}"
    sudo mysql_secure_installation
fi

# Create application directory
echo -e "📂 Creating application directory..."
sudo mkdir -p /var/www/billiard-pos
sudo chown -R $USER:$USER /var/www/billiard-pos

# Clone the repository (or copy files)
echo -e "📥 Cloning repository..."
cd /var/www/billiard-pos
git clone https://github.com/your-username/billiard-pos.git .

# Install application dependencies
echo -e "📦 Installing application dependencies..."
npm ci --production

# Set up environment variables
echo -e "🔧 Setting up environment variables..."
cp .env.example .env
nano .env  # Edit the environment variables as needed

# Set up Nginx
echo -e "🌐 Configuring Nginx..."
sudo rm -f /etc/nginx/sites-enabled/default

# Create Nginx config
cat <<EOL | sudo tee /etc/nginx/sites-available/billiard-pos
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOL

# Enable the site
sudo ln -sf /etc/nginx/sites-available/billiard-pos /etc/nginx/sites-enabled/
sudo nginx -t  # Test Nginx configuration
sudo systemctl restart nginx

# Set up SSL with Let's Encrypt
echo -e "🔒 Setting up SSL with Let's Encrypt..."
sudo certbot --nginx -d your-domain.com

# Set up PM2 to start on boot
echo -e "🔧 Setting up PM2 to start on boot..."
pm2 startup
# Follow the instructions provided by the above command

# Save the PM2 process list
pm2 save

# Set up log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true

echo -e "\n${GREEN}✅ Server setup completed successfully!${NC}"
echo -e "\nNext steps:"
echo -e "1. Configure your database: ${YELLOW}mysql -u root -p${NC}"
echo -e "2. Run database migrations: ${YELLOW}npm run migrate${NC}"
echo -e "3. Start the application: ${YELLOW}pm2 start ecosystem.config.js --env production${NC}"
echo -e "4. Set up a firewall: ${YELLOW}sudo ufw allow ssh && sudo ufw allow http && sudo ufw allow https && sudo ufw enable${NC}"

echo -e "\n${GREEN}🚀 Your Billiard POS Backend is now ready for deployment!${NC}"
