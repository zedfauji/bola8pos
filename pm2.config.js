module.exports = {
  apps: [
    {
      name: 'pos-backend',
      cwd: 'pos/backend',
      script: 'src/server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        HTTPS: 'true'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      out_file: process.env.TEMP ? `${process.env.TEMP}/pos-backend.out.log` : 'logs/pos-backend.out.log',
      error_file: process.env.TEMP ? `${process.env.TEMP}/pos-backend.err.log` : 'logs/pos-backend.err.log',
      time: true
    },
    {
      name: 'pos-frontend',
      cwd: 'pos/frontend',
      script: 'node_modules/vite/bin/vite.js',
      args: '--port 5173 --host localhost',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
        VITE_PORT: 5173,
        VITE_API_URL: 'https://localhost:3001'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      out_file: process.env.TEMP ? `${process.env.TEMP}/pos-frontend.out.log` : 'logs/pos-frontend.out.log',
      error_file: process.env.TEMP ? `${process.env.TEMP}/pos-frontend.err.log` : 'logs/pos-frontend.err.log',
      time: true
    }
  ]
};
