/**
 * JWT Secret Verification Script
 * 
 * This script verifies that the JWT secrets are being loaded correctly
 * from environment variables and fixes any issues.
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

// Check if environment variables are loaded
console.log('Checking JWT environment variables...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('REFRESH_TOKEN_SECRET exists:', !!process.env.REFRESH_TOKEN_SECRET);

// Print the actual values (in production, you would not do this)
if (process.env.NODE_ENV === 'development') {
  console.log('JWT_SECRET:', process.env.JWT_SECRET);
  console.log('REFRESH_TOKEN_SECRET:', process.env.REFRESH_TOKEN_SECRET);
}

// Test token generation and verification
console.log('\nTesting token generation and verification...');

// Create a test user
const testUser = {
  id: 1,
  email: 'test@example.com',
  role: 'admin',
  tokenVersion: 1
};

// Generate tokens
console.log('Generating tokens...');
const accessToken = jwt.sign(
  { 
    userId: testUser.id,
    email: testUser.email,
    role: testUser.role 
  },
  process.env.JWT_SECRET || 'your-secret-key',
  { expiresIn: '15m' }
);

const refreshToken = jwt.sign(
  { 
    userId: testUser.id,
    email: testUser.email,
    tokenVersion: testUser.tokenVersion
  },
  process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret-key',
  { expiresIn: '7d' }
);

console.log('Access token generated:', !!accessToken);
console.log('Refresh token generated:', !!refreshToken);

// Verify tokens
console.log('\nVerifying tokens...');
try {
  const decodedAccess = jwt.verify(accessToken, process.env.JWT_SECRET || 'your-secret-key');
  console.log('Access token verified successfully:', decodedAccess);
} catch (error) {
  console.error('Access token verification failed:', error.message);
}

try {
  const decodedRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret-key');
  console.log('Refresh token verified successfully:', decodedRefresh);
} catch (error) {
  console.error('Refresh token verification failed:', error.message);
}

// Cross-verify tokens with wrong secrets to confirm they fail
console.log('\nCross-verifying tokens (should fail)...');
try {
  jwt.verify(accessToken, 'wrong-secret');
  console.error('ERROR: Access token verified with wrong secret!');
} catch (error) {
  console.log('Access token correctly failed with wrong secret:', error.message);
}

// Check if the secrets match what's in the .env file
console.log('\nVerifying secrets match .env file...');
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  
  const jwtSecretLine = envLines.find(line => line.startsWith('JWT_SECRET='));
  const refreshSecretLine = envLines.find(line => line.startsWith('REFRESH_TOKEN_SECRET='));
  
  if (jwtSecretLine) {
    const envJwtSecret = jwtSecretLine.split('=')[1];
    console.log('JWT_SECRET in .env matches loaded value:', envJwtSecret === process.env.JWT_SECRET);
  } else {
    console.error('JWT_SECRET not found in .env file');
  }
  
  if (refreshSecretLine) {
    const envRefreshSecret = refreshSecretLine.split('=')[1];
    console.log('REFRESH_TOKEN_SECRET in .env matches loaded value:', envRefreshSecret === process.env.REFRESH_TOKEN_SECRET);
  } else {
    console.error('REFRESH_TOKEN_SECRET not found in .env file');
  }
} catch (error) {
  console.error('Error reading .env file:', error.message);
}

console.log('\nJWT verification complete.');
