/**
 * JWT Authentication Debug Script
 * 
 * This script helps diagnose JWT authentication issues by:
 * 1. Clearing existing tokens
 * 2. Performing a fresh login
 * 3. Testing token verification
 * 4. Checking protected API endpoints
 * 5. Navigating to the tables page
 */

// IMPORTANT: This script assumes you've already accepted the self-signed certificate
// by visiting https://localhost:3001 directly in the browser and accepting the warning

// Clear existing tokens
function clearTokens() {
  console.log('Clearing existing tokens...');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('token'); // Legacy token
  localStorage.removeItem('user');
  console.log('Tokens cleared');
}

// Login and get fresh tokens
async function login(email = 'admin@billiardpos.com', password = 'password') {
  console.log(`Attempting login with ${email}...`);
  
  try {
    const response = await fetch('https://localhost:3001/api/access/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include' // Important for cookies
    });
    
    if (!response.ok) {
      throw new Error(`Login failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Login successful!', data);
    
    // Store the access token
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      console.log('Access token stored in localStorage');
      
      // Decode token to check payload
      const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
      console.log('Token payload:', payload);
      console.log('Token expiration:', new Date(payload.exp * 1000).toLocaleString());
      
      return data;
    } else {
      console.error('No access token received');
      return null;
    }
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

// Test a protected API endpoint
async function testProtectedEndpoint() {
  console.log('Testing protected endpoint...');
  const token = localStorage.getItem('accessToken');
  
  if (!token) {
    console.error('No access token available');
    return null;
  }
  
  try {
    const response = await fetch('https://localhost:3001/api/table-layouts/active', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Protected endpoint response:', data);
    return data;
  } catch (error) {
    console.error('Protected endpoint error:', error);
    return null;
  }
}

// Test refresh token
async function testRefreshToken() {
  console.log('Testing refresh token...');
  
  try {
    const response = await fetch('https://localhost:3001/api/access/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include' // Important for cookies
    });
    
    if (!response.ok) {
      throw new Error(`Refresh token failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Refresh token successful!', data);
    
    // Store the new access token
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      console.log('New access token stored in localStorage');
      
      // Decode token to check payload
      const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
      console.log('New token payload:', payload);
      console.log('New token expiration:', new Date(payload.exp * 1000).toLocaleString());
      
      return data;
    } else {
      console.error('No access token received from refresh');
      return null;
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    return null;
  }
}

// Navigate to tables page after successful authentication
function navigateToTablesPage() {
  console.log('Navigating to tables page...');
  window.location.href = '/tables';
}

// Run all tests
async function runAuthTests() {
  console.log('=== Starting Authentication Tests ===');
  clearTokens();
  
  const loginResult = await login();
  if (!loginResult) {
    console.error('Login failed, cannot continue tests');
    return;
  }
  
  const endpointResult = await testProtectedEndpoint();
  if (!endpointResult) {
    console.error('Protected endpoint test failed');
  } else {
    console.log('Protected endpoint test successful!');
  }
  
  const refreshResult = await testRefreshToken();
  if (!refreshResult) {
    console.error('Refresh token test failed');
  } else {
    console.log('Refresh token test successful!');
  }
  
  console.log('=== Authentication Tests Complete ===');
  
  // Ask user if they want to navigate to tables page
  if (confirm('Authentication tests completed. Navigate to tables page now?')) {
    navigateToTablesPage();
  }
}

// Execute all tests
runAuthTests();
