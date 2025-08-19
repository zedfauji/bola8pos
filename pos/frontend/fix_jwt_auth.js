/**
 * JWT Authentication Fix Script
 * 
 * This script:
 * 1. Completely clears all tokens and user data
 * 2. Performs a direct fetch login without using existing services
 * 3. Tests the token with a protected endpoint
 * 4. Provides detailed diagnostics
 */

// Clear all possible tokens and user data
function clearAllTokens() {
  console.log('Clearing all possible tokens and user data...');
  
  // Clear localStorage
  localStorage.removeItem('accessToken');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('refreshToken');
  
  // Clear sessionStorage
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('refreshToken');
  
  console.log('All tokens cleared');
}

// Perform direct login without using existing services
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
    
    if (data.accessToken) {
      // Store token in localStorage
      localStorage.setItem('accessToken', data.accessToken);
      
      // Store user data if available
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      
      console.log('Token and user data stored in localStorage');
      
      // Decode token to check payload
      const payload = decodeToken(data.accessToken);
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

// Test protected endpoint
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

// Navigate to tables page
function navigateToTables() {
  console.log('Navigating to tables page...');
  window.location.href = '/tables';
}

// Run the fix
async function runJwtFix() {
  console.log('=== Starting JWT Authentication Fix ===');
  
  // Clear all tokens
  clearAllTokens();
  
  // Perform direct login
  const loginResult = await directLogin();
  if (!loginResult) {
    console.error('Login failed, cannot continue');
    return;
  }
  
  // Test protected endpoint
  const endpointResult = await testProtectedEndpoint();
  if (!endpointResult) {
    console.error('Protected endpoint test failed');
    return;
  }
  
  console.log('JWT authentication fix successful!');
  
  // Ask to navigate to tables page
  if (confirm('Authentication fixed successfully. Navigate to tables page now?')) {
    navigateToTables();
  }
}

// Execute the fix
runJwtFix();
