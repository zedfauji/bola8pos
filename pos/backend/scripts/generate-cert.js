const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const certDir = path.join(__dirname, '..', 'certs');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
  console.log('Created certs directory');
}

// Check if certificates already exist
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log('Certificates already exist. Skipping generation.');
  process.exit(0);
}

// Generate self-signed certificate
console.log('Generating self-signed certificate...');
try {
  execSync(
    `openssl req -x509 -newkey rsa:4096 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`,
    { stdio: 'inherit' }
  );
  console.log('\nCertificates generated successfully!');
  console.log(`Key: ${keyPath}`);
  console.log(`Certificate: ${certPath}`);
} catch (error) {
  console.error('Error generating certificates:', error.message);
  console.log('\nNote: If you don\'t have OpenSSL installed, you can install it from:');
  console.log('  - Windows: https://slproweb.com/products/Win32OpenSSL.html');
  console.log('  - Mac: brew install openssl');
  console.log('  - Linux: sudo apt-get install openssl');
  process.exit(1);
}
