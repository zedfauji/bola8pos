/**
 * Simple login test script
 * 
 * This script performs a fresh login and displays the token
 * without any localStorage persistence
 */

async function testLogin() {
  console.log('Testing direct login...');
  
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
      // Decode token to check payload
      const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
      console.log('Token payload:', payload);
      console.log('Token expiration:', new Date(payload.exp * 1000).toLocaleString());
      
      // Test the token immediately with a protected endpoint
      console.log('Testing token with protected endpoint...');
      const testResponse = await fetch('https://localhost:3001/api/table-layouts/active', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${data.accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!testResponse.ok) {
        console.error(`Protected endpoint test failed with status: ${testResponse.status}`);
        return null;
      }
      
      const testData = await testResponse.json();
      console.log('Protected endpoint response:', testData);
      
      return data;
    } else {
      console.error('No access token received');
      return null;
    }
  } catch (error) {
    console.error('Login test error:', error);
    return null;
  }
}

// Run the test
testLogin();
