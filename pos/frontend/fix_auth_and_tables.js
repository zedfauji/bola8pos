/**
 * Authentication and Table Layout Fix Script
 * 
 * This script:
 * 1. Clears all tokens from localStorage
 * 2. Performs a fresh login
 * 3. Navigates to the tables page
 * 4. Monitors for errors
 */

// Clear all tokens from localStorage
function clearTokens() {
  console.log('Clearing all tokens from localStorage...');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('token'); // Legacy token
  localStorage.removeItem('user');
  console.log('Tokens cleared');
}

// Login with admin credentials
async function login() {
  console.log('Logging in with admin credentials...');
  
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
      throw new Error(`Login failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Login successful!', data);
    
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      console.log('Token stored in localStorage');
      
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

// Navigate to tables page
function navigateToTables() {
  console.log('Navigating to tables page...');
  window.location.href = '/tables';
}

// Set up error monitoring
function monitorErrors() {
  console.log('Setting up error monitoring...');
  
  // Store original console.error
  const originalError = console.error;
  
  // Override console.error to log and report
  console.error = function(...args) {
    // Call original console.error
    originalError.apply(console, args);
    
    // Log the error with timestamp
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ERROR DETECTED:`, args);
    
    // Check for authentication errors
    const errorStr = args.join(' ');
    if (errorStr.includes('401') || 
        errorStr.includes('unauthorized') || 
        errorStr.includes('Unauthorized') ||
        errorStr.includes('token') ||
        errorStr.includes('Token') ||
        errorStr.includes('JWT')) {
      console.log('Authentication error detected!');
    }
  };
  
  // Monitor fetch/XHR requests
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    try {
      const response = await originalFetch.apply(this, args);
      
      // Log failed requests
      if (!response.ok) {
        console.log(`[Fetch Error] ${args[0]} - Status: ${response.status}`);
        
        if (response.status === 401) {
          console.log('Authentication error detected in fetch request!');
        }
      }
      
      return response;
    } catch (error) {
      console.log(`[Fetch Exception] ${args[0]} - ${error.message}`);
      throw error;
    }
  };
  
  // Monitor unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    console.log('[Unhandled Promise Rejection]', event.reason);
  });
}

// Run the full fix process
async function runFix() {
  console.log('=== Starting Authentication and Table Layout Fix ===');
  
  // Set up error monitoring first
  monitorErrors();
  
  // Clear tokens
  clearTokens();
  
  // Login
  const loginResult = await login();
  if (!loginResult) {
    console.error('Login failed, cannot continue');
    return;
  }
  
  // Navigate to tables page
  console.log('Login successful, navigating to tables page in 2 seconds...');
  setTimeout(navigateToTables, 2000);
}

// Execute the fix
runFix();
