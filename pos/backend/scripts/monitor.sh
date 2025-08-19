#!/bin/bash

# Monitoring script for Billiard POS Backend
# This script checks the health of the application and sends alerts if needed

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="billiard-pos-backend"
HEALTH_CHECK_URL="http://localhost:3001/health"
LOG_FILE="/var/log/billiard-pos/monitor.log"
ALERT_EMAIL="admin@example.com"
MAX_CPU=80
MAX_MEM=80
MAX_DISK=85

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

timestamp() {
  date "+%Y-%m-%d %H:%M:%S"
}

log() {
  echo -e "[$(timestamp)] $1" | tee -a "$LOG_FILE"
}

send_alert() {
  local subject="[ALERT] $1"
  local message="$2"
  echo -e "$message" | mail -s "$subject" "$ALERT_EMAIL"
  log "ALERT: $subject"
}

# Check if PM2 is running
if ! pgrep -x "pm2" > /dev/null; then
  log "${RED}PM2 is not running!${NC}"
  send_alert "PM2 is not running" "PM2 process manager is not running. Application may be down."
  exit 1
fi

# Check if the application is running
if ! pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  log "${RED}Application $APP_NAME is not running!${NC}"
  send_alert "Application $APP_NAME is not running" "The application $APP_NAME is not running in PM2."
  exit 1
fi

# Check application health
response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" 2>/dev/null)
if [ "$response" != "200" ]; then
  log "${RED}Health check failed with status code: $response${NC}"
  send_alert "Health check failed" "Health check for $APP_NAME returned status code $response."
  
  # Try to restart the application
  log "Attempting to restart $APP_NAME..."
  pm2 restart "$APP_NAME"
  
  # Check if restart was successful
  sleep 5
  response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" 2>/dev/null)
  if [ "$response" = "200" ]; then
    log "${GREEN}Application restarted successfully${NC}"
    send_alert "Application restarted" "$APP_NAME was restarted successfully after a health check failure."
  else
    log "${RED}Failed to restart $APP_NAME${NC}"
    send_alert "Application restart failed" "Failed to restart $APP_NAME after health check failure."
  fi
fi

# Check system resources
cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}' | cut -d. -f1)
mem_usage=$(free | grep Mem | awk '{print $3/$2 * 100.0}' | cut -d. -f1)
disk_usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')

if [ "$cpu_usage" -gt "$MAX_CPU" ]; then
  log "${YELLOW}High CPU usage: ${cpu_usage}%${NC}"
  send_alert "High CPU usage" "CPU usage is at ${cpu_usage}%, which is above the threshold of ${MAX_CPU}%."
fi

if [ "$mem_usage" -gt "$MAX_MEM" ]; then
  log "${YELLOW}High memory usage: ${mem_usage}%${NC}"
  send_alert "High memory usage" "Memory usage is at ${mem_usage}%, which is above the threshold of ${MAX_MEM}%."
fi

if [ "$disk_usage" -gt "$MAX_DISK" ]; then
  log "${YELLOW}High disk usage: ${disk_usage}%${NC}"
  send_alert "High disk usage" "Disk usage is at ${disk_usage}%, which is above the threshold of ${MAX_DISK}%."
fi

# Log current status
log "${GREEN}Status OK - CPU: ${cpu_usage}%, Memory: ${mem_usage}%, Disk: ${disk_usage}%${NC}"

# Optional: Log application metrics
pm2 monit >> "$LOG_FILE" 2>&1

# Optional: Log slow database queries (if enabled in MySQL)
# mysql -u root -p -e "SHOW PROCESSLIST;" >> "$LOG_FILE" 2>&1

exit 0
