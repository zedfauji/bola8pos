const path = require('path');
const rootDir = __dirname;
const logsDir = path.join(rootDir, 'pos/logs');

module.exports = {
  apps: [
    {
      name: 'pos-backend',
      script: path.join(rootDir, 'pos/backend/src/server.js'),
      cwd: path.join(rootDir, 'pos/backend'),
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        // Force HTTP mode for consistency to avoid SSL errors
        HTTPS: 'false'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: path.join(logsDir, 'backend-error.log'),
      out_file: path.join(logsDir, 'backend-out.log'),
      merge_logs: true,
      time: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 3000,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Graceful shutdown with timeout
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    },
    {
      name: 'pos-frontend',
      script: path.join(rootDir, 'run-frontend.js'),
      cwd: rootDir,
      interpreter: 'node',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: path.join(logsDir, 'frontend-error.log'),
      out_file: path.join(logsDir, 'frontend-out.log'),
      merge_logs: true,
      time: true,
      watch: false,
      ignore_watch: ['node_modules', '.git', 'logs'],
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'development',
        VITE_API_BASE_URL: 'http://localhost:3001'
      }
    }
  ]
};
