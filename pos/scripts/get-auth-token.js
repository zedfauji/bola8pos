const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3001/api';
const LOGIN_CREDENTIALS = {
  email: 'admin@billiardpos.com',
  password: 'password'
};

async function getAuthToken() {
  try {
    console.log('Attempting to login and get auth token...');
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, LOGIN_CREDENTIALS);
    
    if (response.data && response.data.token) {
      console.log('Login successful!');
      console.log('Auth Token:', response.data.token);
      return response.data.token;
    } else {
      console.error('Login successful but no token returned in response:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Login failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

// Execute the function
getAuthToken();
