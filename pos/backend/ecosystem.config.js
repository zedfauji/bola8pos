module.exports = {
  apps: [
    {
      name: 'billiard-pos-backend',
      script: 'src/server.js',
      instances: 'max',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        FRONTEND_URL: 'http://localhost:5173',
        JWT_SECRET: 'your-secret-key',
        DB_HOST: 'localhost',
        DB_PORT: 3306,
        DB_USER: 'root',
        DB_PASSWORD: '',
        DB_NAME: 'billiard_pos',
        LOG_LEVEL: 'info'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        FRONTEND_URL: 'https://your-production-domain.com',
        JWT_SECRET: 'your-production-secret-key',
        DB_HOST: 'production-db-host',
        DB_PORT: 3306,
        DB_USER: 'prod_user',
        DB_PASSWORD: 'prod_password',
        DB_NAME: 'billiard_pos_prod',
        LOG_LEVEL: 'warn',
        HTTPS: 'true',
        // Add other production environment variables here
      }
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/billiard-pos.git',
      path: '/var/www/billiard-pos',
      'post-deploy': 'cd backend && npm install && npm run migrate && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
