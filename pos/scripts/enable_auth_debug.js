// This script enables debug logging for authentication in the backend
const fs = require('fs');
const path = require('path');

const AUTH_MIDDLEWARE_PATH = path.join(__dirname, '..', 'backend', 'src', 'middleware', 'auth.middleware.js');
const AUTH_ROUTES_PATH = path.join(__dirname, '..', 'backend', 'src', 'routes', 'access', 'auth.routes.js');

if (!fs.existsSync(AUTH_MIDDLEWARE_PATH) || !fs.existsSync(AUTH_ROUTES_PATH)) {
  console.error('❌ Could not find auth middleware or routes files');
  process.exit(1);
}

// Enable debug logging in auth middleware
let authMiddleware = fs.readFileSync(AUTH_MIDDLEWARE_PATH, 'utf8');
if (!authMiddleware.includes('console.log(') && !authMiddleware.includes('DEBUG: ')) {
  const debugLogs = `
// DEBUG: Authentication debug logging
console.log('🔐 Auth Middleware: Starting authentication check');
console.log('🔑 Request headers:', JSON.stringify(req.headers, null, 2));
`;
  
  // Find the beginning of the middleware function
  const middlewareStart = authMiddleware.indexOf('exports.authenticateToken = (req, res, next) =>');
  if (middlewareStart !== -1) {
    const insertPos = authMiddleware.indexOf('{', middlewareStart) + 1;
    authMiddleware = authMiddleware.slice(0, insertPos) + debugLogs + authMiddleware.slice(insertPos);
    fs.writeFileSync(AUTH_MIDDLEWARE_PATH, authMiddleware);
    console.log('✅ Added debug logging to auth middleware');
  } else {
    console.log('⚠️ Could not find middleware function to add debug logs');
  }
}

// Enable debug logging in auth routes
let authRoutes = fs.readFileSync(AUTH_ROUTES_PATH, 'utf8');
if (!authRoutes.includes('console.log(') && !authRoutes.includes('DEBUG: ')) {
  const debugLogs = `
// DEBUG: Login route debug logging
console.log('🔑 Login attempt:', { email: req.body.email });
`;
  
  // Find the login route
  const loginRouteStart = authRoutes.indexOf('router.post(\'/login\'');
  if (loginRouteStart !== -1) {
    const insertPos = authRoutes.indexOf('{', loginRouteStart) + 1;
    authRoutes = authRoutes.slice(0, insertPos) + debugLogs + authRoutes.slice(insertPos);
    
    // Also add response logging
    const responseLog = `
    // DEBUG: Log successful login
    console.log('✅ Login successful for user:', user.email);
    console.log('🔑 Access token generated');
    `;
    
    const successPos = authRoutes.indexOf('res.json({', loginRouteStart);
    if (successPos !== -1) {
      const insertSuccessPos = authRoutes.lastIndexOf('{', successPos) + 1;
      authRoutes = authRoutes.slice(0, insertSuccessPos) + responseLog + authRoutes.slice(insertSuccessPos);
    }
    
    fs.writeFileSync(AUTH_ROUTES_PATH, authRoutes);
    console.log('✅ Added debug logging to auth routes');
  } else {
    console.log('⚠️ Could not find login route to add debug logs');
  }
}

console.log('\n🔄 Restarting backend server to apply changes...');

// Restart the backend server
const { exec } = require('child_process');
const backendProcess = exec('cd backend && npm run dev:https');

backendProcess.stdout.on('data', (data) => {
  console.log(`Backend: ${data}`);
});

backendProcess.stderr.on('data', (data) => {
  console.error(`Backend Error: ${data}`);
});

console.log('\n🔍 Now try to log in again and check the backend console for debug output.');
console.log('📝 Look for lines starting with 🔐, 🔑, or ✅ to track the authentication flow.');
