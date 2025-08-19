const path = require('path');
const rootDir = __dirname;

module.exports = {
  apps: [
    {
      name: 'pos-backend',
      script: path.join(rootDir, 'pos/backend/src/server.js'),
      cwd: path.join(rootDir, 'pos/backend'),
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'pos-frontend',
      script: path.join(rootDir, 'run-frontend.js'),
      cwd: rootDir,
      interpreter: 'node',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: 'pos/logs/frontend-pm2-error.log',
      out_file: 'pos/logs/frontend-pm2-out.log',
      merge_logs: true,
      time: true,
      watch: false,
      ignore_watch: ['node_modules'],
      autorestart: true,
      max_restarts: 5,
      min_uptime: '5s',
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
};
