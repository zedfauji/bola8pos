const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'pos', 'frontend', 'dev.out.log');

console.log('Checking log file at:', logPath);

if (fs.existsSync(logPath)) {
  console.log('File exists. Contents:');
  const stats = fs.statSync(logPath);
  console.log(`File size: ${stats.size} bytes`);
  
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    console.log('File content (first 1000 chars):');
    console.log(content.substring(0, 1000));
  } catch (error) {
    console.error('Error reading file:', error);
  }
} else {
  console.error('Log file does not exist');
}
