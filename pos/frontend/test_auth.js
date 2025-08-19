// Script to test authentication flow
console.log('Testing authentication flow...');

// Function to test authentication
async function testAuth() {
  try {
    // Clear any existing tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.log('✓ Cleared existing tokens');
    
    // Make login request
    const loginResponse = await fetch('https://localhost:3001/api/auth/login', {
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
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed with status: ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    console.log('✓ Login successful', loginData);
    
    // Store the access token
    if (loginData.accessToken) {
      localStorage.setItem('accessToken', loginData.accessToken);
      console.log('✓ Access token stored in localStorage');
    }
    
    // Test protected endpoint
    const testResponse = await fetch('https://localhost:3001/api/tables', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      credentials: 'include'
    });
    
    if (!testResponse.ok) {
      throw new Error(`Protected endpoint test failed with status: ${testResponse.status}`);
    }
    
    const testData = await testResponse.json();
    console.log('✓ Protected endpoint test successful', testData);
    
    console.log('Authentication flow test completed successfully!');
  } catch (error) {
    console.error('❌ Authentication test failed:', error);
  }
}

// Execute the test
testAuth();
