const https = require('https');
const fs = require('fs');

// Skip SSL certificate validation (for self-signed certs)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const loginData = JSON.stringify({
  email: 'admin@billiardpos.com',
  password: 'password'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
};

console.log('Attempting login...');
const req = https.request(options, (res) => {
  console.log(`Login Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('Login Response:', response);
      
      if (response.accessToken) {
        console.log('\nTesting tables endpoint with access token...');
        testTablesEndpoint(response.accessToken);
      }
    } catch (e) {
      console.error('Error parsing login response:', e);
    }
  });
});

req.on('error', (error) => {
  console.error('Login Error:', error);
});

req.write(loginData);
req.end();

function testTablesEndpoint(accessToken) {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/tables',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    console.log(`\nTables Status: ${res.statusCode}`);
    console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        console.log('Tables Response:', JSON.stringify(JSON.parse(data), null, 2));
      } catch (e) {
        console.log('Raw Response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Tables Error:', error);
  });

  req.end();
}
