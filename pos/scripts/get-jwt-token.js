/**
 * Script to get a JWT token for testing
 * 
 * This script logs in to the API and returns a JWT token that can be used for testing
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const EMAIL = process.env.API_EMAIL || 'admin@billiardpos.com';
const PASSWORD = process.env.API_PASSWORD || 'password';

async function getJwtToken() {
  try {
    console.log(`Logging in to ${API_BASE_URL} as ${EMAIL}...`);
    
    const response = await axios.post(`${API_BASE_URL}/api/access/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    if (response.data && response.data.accessToken) {
      console.log('Login successful!');
      console.log(`\nJWT Token: ${response.data.accessToken}`);
      console.log('\nYou can use this token in your test scripts by setting the JWT_TOKEN environment variable:');
      console.log(`\nOn Windows PowerShell:`);
      console.log(`$env:JWT_TOKEN="${response.data.accessToken}"`);
      console.log(`\nOn Windows CMD:`);
      console.log(`set JWT_TOKEN=${response.data.accessToken}`);
      console.log(`\nOn Linux/Mac:`);
      console.log(`export JWT_TOKEN="${response.data.accessToken}"`);
      
      return response.data.accessToken;
    } else {
      console.error('Login successful but no token received');
      console.log('Response:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Login failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  getJwtToken();
}

module.exports = { getJwtToken };
