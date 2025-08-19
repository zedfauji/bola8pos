# Billiard POS Backend - Deployment Guide

This guide provides instructions for deploying the Billiard POS Backend in a production environment.

## Prerequisites

- Ubuntu/Debian server (20.04 LTS or later recommended)
- Node.js 18.x
- MySQL 8.0 or later
- Nginx
- PM2
- Git

## Server Setup

1. **Update and upgrade system packages**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Install required dependencies**
   ```bash
   sudo apt install -y git curl wget unzip build-essential python3 python3-pip
   ```

3. **Install Node.js 18.x**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

4. **Install PM2 globally**
   ```bash
   sudo npm install -g pm2
   ```

5. **Install and configure MySQL**
   ```bash
   sudo apt install -y mysql-server
   sudo mysql_secure_installation
   ```

## Application Setup

1. **Clone the repository**
   ```bash
   sudo mkdir -p /var/www
   sudo chown -R $USER:$USER /var/www
   cd /var/www
   git clone https://github.com/your-username/billiard-pos.git
   cd billiard-pos/backend
   ```

2. **Install dependencies**
   ```bash
   npm ci --production
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   nano .env
   ```
   Update the following variables:
   ```
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=your-secure-jwt-secret
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_db_user
   DB_PASSWORD=your_secure_password
   DB_NAME=billiard_pos
   ```

4. **Set up the database**
   ```bash
   # Log in to MySQL
   sudo mysql -u root -p
   
   # Create database and user
   CREATE DATABASE billiard_pos;
   CREATE USER 'your_db_user'@'localhost' IDENTIFIED BY 'your_secure_password';
   GRANT ALL PRIVILEGES ON billiard_pos.* TO 'your_db_user'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

## Configure Nginx as a Reverse Proxy

1. **Install Nginx**
   ```bash
   sudo apt install -y nginx
   ```

2. **Create Nginx configuration**
   ```bash
   sudo nano /etc/nginx/sites-available/billiard-pos
   ```
   
   Add the following configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```

3. **Enable the site**
   ```bash
   sudo ln -s /etc/nginx/sites-available/billiard-pos /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. **Set up SSL with Let's Encrypt**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## Running the Application

1. **Start the application with PM2**
   ```bash
   pm2 start ecosystem.config.js --env production
   ```

2. **Set up PM2 to start on boot**
   ```bash
   pm2 startup
   # Follow the instructions provided by the above command
   pm2 save
   ```

3. **Set up log rotation**
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 30
   pm2 set pm2-logrotate:compress true
   ```

## Monitoring

The application includes a monitoring script that checks the health of the application and system resources. To set it up:

1. Make the script executable:
   ```bash
   chmod +x scripts/monitor.sh
   ```

2. Add a cron job to run the monitor script every 5 minutes:
   ```bash
   crontab -e
   ```
   Add the following line:
   ```
   */5 * * * * /var/www/billiard-pos/backend/scripts/monitor.sh
   ```

## Updating the Application

To update the application to the latest version:

```bash
cd /var/www/billiard-pos/backend
git pull
npm ci --production
npm run migrate
pm2 reload ecosystem.config.js --env production
```

## Backup and Restore

### Backup Database
```bash
mysqldump -u your_db_user -p billiard_pos > billiard_pos_backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
mysql -u your_db_user -p billiard_pos < backup_file.sql
```

## Troubleshooting

- **Check PM2 logs**: `pm2 logs billiard-pos-backend`
- **Check Nginx error logs**: `sudo tail -f /var/log/nginx/error.log`
- **Check application logs**: `tail -f /var/log/billiard-pos/monitor.log`

## Security Considerations

1. Keep your server and dependencies up to date
2. Use strong passwords for all accounts
3. Configure a firewall (e.g., UFW)
4. Regularly back up your database
5. Monitor application logs for suspicious activity
6. Use HTTPS for all communications
7. Restrict database access to only the necessary IP addresses

## Support

For support, please open an issue in the GitHub repository or contact the development team.
