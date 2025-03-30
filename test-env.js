const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  console.log(`Found environment file at: ${envPath}`);
  console.log(`File size: ${fs.statSync(envPath).size} bytes`);
  
  // Read the raw content (without displaying sensitive info)
  const fileContent = fs.readFileSync(envPath, 'utf8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  console.log(`File contains ${lines.length} non-empty lines`);
  
  // Load the environment
  dotenv.config({ path: envPath });
  console.log('Environment loaded');
} else {
  console.error(`Environment file not found at: ${envPath}`);
}

// Check for environment variables
console.log('\nEnvironment Variables:');
if (process.env.ETHERSCAN_API_KEY) {
  const key = process.env.ETHERSCAN_API_KEY;
  console.log(`ETHERSCAN_API_KEY: Present (${key.length} chars), starts with ${key.substring(0, 4)}, ends with ${key.substring(key.length - 4)}`);
} else {
  console.log('ETHERSCAN_API_KEY: Not found');
}

if (process.env.INFURA_API_KEY) {
  const key = process.env.INFURA_API_KEY;
  console.log(`INFURA_API_KEY: Present (${key.length} chars), starts with ${key.substring(0, 4)}, ends with ${key.substring(key.length - 4)}`);
} else {
  console.log('INFURA_API_KEY: Not found');
}

// Check other environment variables
console.log('\nOther Environment Variables:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);
console.log(`NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || 'Not set'}`);
console.log(`NEXT_PUBLIC_WS_URL: ${process.env.NEXT_PUBLIC_WS_URL || 'Not set'}`);

console.log('\nTest complete!'); 