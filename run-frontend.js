const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'pos', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const out = fs.openSync(path.join(logsDir, 'frontend-out.log'), 'a');
const err = fs.openSync(path.join(logsDir, 'frontend-error.log'), 'a');

// Launch Vite directly with Node to avoid npm.cmd being executed by Node on Windows
const frontendCwd = path.join(__dirname, 'pos', 'frontend');
// Check if vite.js exists and use alternative paths if needed
let viteBin = path.join(frontendCwd, 'node_modules', 'vite', 'bin', 'vite.js');
if (!fs.existsSync(viteBin)) {
  // Try alternative paths
  const alternatives = [
    path.join(frontendCwd, 'node_modules', '.bin', 'vite'),
    path.join(frontendCwd, 'node_modules', '.bin', 'vite.cmd'),
    path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
    path.join(__dirname, 'node_modules', '.bin', 'vite')
  ];
  
  for (const alt of alternatives) {
    if (fs.existsSync(alt)) {
      viteBin = alt;
      console.log(`Using alternative Vite path: ${viteBin}`);
      break;
    }
  }
}

// Log whether vite was found
if (!fs.existsSync(viteBin)) {
  console.error('Error: Could not find Vite executable. Please ensure Vite is installed.');
  process.exit(1);
} else {
  console.log(`Using Vite at: ${viteBin}`);
}
const nodeExec = process.execPath; // current Node executable

const env = {
  ...process.env,
  // Keep Vite port consistent with PM2 config and Selenium tests
  PORT: '5173',
  VITE_PORT: '5173',
  // Ensure API URL includes /api and protocol; backend uses HTTP on 3001 via pm2
  VITE_API_URL: process.env.VITE_API_URL || 'http://localhost:3001/api',
  BROWSER: 'none',
  FORCE_COLOR: '1',
};

// Determine if we need to use the full path or just the command
const isScript = viteBin.endsWith('.js');
const args = isScript ? [viteBin, '--port', env.VITE_PORT, '--host', '127.0.0.1'] : ['--port', env.VITE_PORT, '--host', '127.0.0.1'];
const execCommand = isScript ? nodeExec : viteBin;
const frontend = spawn(execCommand, args, {
  cwd: frontendCwd,
  env,
  stdio: ['ignore', out, err],
  shell: false,
  windowsHide: false,
});

console.log(`Frontend process started with PID: ${frontend.pid}`);
console.log(`Logs are being written to: ${path.join(logsDir, 'frontend-*.log')}`);

frontend.on('close', (code) => {
  console.log(`Frontend process exited with code ${code}`);
  process.exit(code);
});

process.on('SIGINT', () => {
  console.log('Shutting down frontend...');
  frontend.kill();
  process.exit(0);
});
