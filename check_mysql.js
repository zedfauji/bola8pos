const net = require('net');
const port = 3306; // Default MySQL port

const client = new net.Socket();

client.setTimeout(2000); // 2 second timeout

client.on('connect', () => {
  console.log(`✅ MySQL server is running on port ${port}`);
  client.destroy();
  process.exit(0);
});

client.on('timeout', () => {
  console.log(`❌ Connection to MySQL server on port ${port} timed out`);
  client.destroy();
  process.exit(1);
});

client.on('error', (err) => {
  console.error(`❌ Error connecting to MySQL server on port ${port}: ${err.message}`);
  process.exit(1);
});

console.log(`Attempting to connect to MySQL server on port ${port}...`);
client.connect(port, '127.0.0.1');
