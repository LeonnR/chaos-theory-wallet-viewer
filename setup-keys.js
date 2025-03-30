#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ENV_FILE = '.env.local';

console.log('\n🔑 Wallet Transaction Viewer API Key Setup 🔑\n');
console.log('This script will help you set up the required API keys for your project.\n');

// Check if .env.local exists
let existingEnv = {};
if (fs.existsSync(ENV_FILE)) {
  const content = fs.readFileSync(ENV_FILE, 'utf8');
  content.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const parts = line.split('=');
      if (parts.length === 2) {
        existingEnv[parts[0].trim()] = parts[1].trim();
      }
    }
  });
}

console.log('📋 API Keys Needed:\n');
console.log('1. Infura API Key - for connecting to Ethereum blockchain');
console.log('   Get one for free at: https://infura.io\n');
console.log('2. Etherscan API Key - for fetching transaction history');
console.log('   Get one for free at: https://etherscan.io/apis\n');

const askForKey = (name, existingValue, description, url) => {
  return new Promise((resolve) => {
    const defaultValue = existingValue && existingValue !== 'YOUR_INFURA_API_KEY' ? existingValue : '';
    
    console.log(`\n🔑 ${name} Key:`);
    if (description) console.log(description);
    if (url) console.log(`Get one at: ${url}`);
    
    rl.question(`Enter your ${name} key${defaultValue ? ` (current: ${defaultValue.slice(0, 4)}...${defaultValue.slice(-4)})` : ''}: `, (answer) => {
      const value = answer.trim() || defaultValue;
      resolve(value);
    });
  });
};

const main = async () => {
  try {
    // Ask for Infura key
    const infuraKey = await askForKey(
      'Infura', 
      existingEnv.INFURA_API_KEY,
      'Used for connecting to the Ethereum blockchain',
      'https://infura.io'
    );
    
    // Ask for Etherscan key
    const etherscanKey = await askForKey(
      'Etherscan', 
      existingEnv.ETHERSCAN_API_KEY,
      'Used for fetching transaction history',
      'https://etherscan.io/apis'
    );
    
    // Prepare the .env file content
    const envContent = `# Blockchain Provider API Keys
INFURA_API_KEY=${infuraKey}
ETHERSCAN_API_KEY=${etherscanKey}

# App URL for CORS
NEXT_PUBLIC_APP_URL=${existingEnv.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}
NEXT_PUBLIC_WS_URL=${existingEnv.NEXT_PUBLIC_WS_URL || '/api/socket'}
`;
    
    // Write to the .env file
    fs.writeFileSync(ENV_FILE, envContent);
    
    console.log('\n✅ API keys have been saved to .env.local');
    console.log('\n🚀 You can now start your application with:');
    console.log('   npm run dev');
    
  } catch (error) {
    console.error('\n❌ Error setting up keys:', error);
  } finally {
    rl.close();
  }
};

main(); 