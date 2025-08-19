const https = require('https');
const fs = require('fs');

// Enable debug logging
process.env.DEBUG = 'app:*';

// Skip SSL certificate validation (for self-signed certs)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Create a log file
const logStream = fs.createWriteStream('login_test.log', { flags: 'a' });
const log = (...args) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  process.stdout.write(logMessage);
  logStream.write(logMessage);
};

const loginData = JSON.stringify({
  email: 'admin@billiardpos.com',
  password: 'password'
});

log('Login request data:', loginData);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/access/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length,
    'Accept': 'application/json'
  },
  // Important: Add this to handle cookies
  withCredentials: true
};

log('Attempting login...');
log('Request options:', JSON.stringify(options, null, 2));

const req = https.request(options, (res) => {
  log(`Status Code: ${res.statusCode}`);
  log('Response Headers:', JSON.stringify(res.headers, null, 2));
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const responseData = data ? JSON.parse(data) : {};
      log('Response:', JSON.stringify(responseData, null, 2));
      
      // Log set-cookie header if present
      if (res.headers['set-cookie']) {
        log('Set-Cookie header:', res.headers['set-cookie']);
      }
      
      // If login was successful, try to get tables
      if (res.statusCode === 200) {
        const response = JSON.parse(data);
        if (response.accessToken) {
          console.log('\nTesting tables endpoint with access token...');
          testTablesEndpoint(response.accessToken);
        }
      }
    } catch (e) {
      log('Error parsing response:', e);
      log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  log('Request error:', error);
});

req.on('socket', (socket) => {
  log('Socket assigned to request');
  
  socket.on('secureConnect', () => {
    log('TLS handshake completed successfully');
    log('TLS version:', socket.getProtocol());
    log('Cipher:', socket.getCipher());
    log('Peer certificate:', JSON.stringify(socket.getPeerCertificate(), null, 2));
  });
  
  socket.on('error', (error) => {
    log('Socket error:', error);
  });
});

// Write data to request body
log('Sending request...');
req.write(loginData);
req.end();
log('Request sent, waiting for response...');

function testTablesEndpoint(accessToken) {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/tables',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  console.log('\nSending request to /api/tables with token:', accessToken.substring(0, 20) + '...');
  
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
