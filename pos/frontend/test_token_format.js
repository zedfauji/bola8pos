/**
 * JWT Token Format Test Script
 * 
 * This script:
 * 1. Clears all tokens
 * 2. Performs a direct login
 * 3. Inspects the token format
 * 4. Makes a test request with the token
 * 5. Logs all headers for debugging
 */

// Clear all tokens
function clearTokens() {
  console.log('Clearing all tokens...');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  console.log('Tokens cleared');
}

// Perform direct login
async function directLogin() {
  console.log('Performing direct login...');
  
  try {
    const response = await fetch('https://localhost:3001/api/access/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        email: 'admin@billiardpos.com', 
        password: 'password' 
      }),
      credentials: 'include' // Important for cookies
    });
    
    if (!response.ok) {
      console.error(`Login failed with status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('Login successful!', data);
    
    return data;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

// Decode JWT token
function decodeToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding token:', error);
    return {};
  }
}

// Test protected endpoint with detailed logging
async function testProtectedEndpoint(token) {
  console.log('Testing protected endpoint with token...');
  console.log('Token format:', token);
  console.log('Authorization header:', `Bearer ${token}`);
  
  try {
    // Log the request details
    console.log('Making request to: https://localhost:3001/api/table-layouts/active');
    
    const response = await fetch('https://localhost:3001/api/table-layouts/active', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries([...response.headers.entries()]));
    
    if (!response.ok) {
      console.error(`Protected endpoint test failed with status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('Protected endpoint test successful!', data);
    return data;
  } catch (error) {
    console.error('Protected endpoint error:', error);
    return null;
  }
}

// Run the test
async function runTokenTest() {
  console.log('=== Starting JWT Token Format Test ===');
  
  // Clear tokens
  clearTokens();
  
  // Login
  const loginResult = await directLogin();
  if (!loginResult || !loginResult.accessToken) {
    console.error('Login failed or no token received, cannot continue');
    return;
  }
  
  const token = loginResult.accessToken;
  
  // Store token in localStorage
  localStorage.setItem('accessToken', token);
  console.log('Token stored in localStorage');
  
  // Inspect token
  console.log('Token length:', token.length);
  console.log('Token parts:', token.split('.').length);
  console.log('Token format valid:', token.split('.').length === 3);
  
  // Decode token
  const decoded = decodeToken(token);
  console.log('Decoded token payload:', decoded);
  
  // Test protected endpoint
  await testProtectedEndpoint(token);
  
  console.log('=== JWT Token Format Test Complete ===');
}

// Execute the test
runTokenTest();
