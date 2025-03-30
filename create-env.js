#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ENV_FILE = '.env.local';

console.log('\n🔑 Wallet Transaction Viewer Setup 🔑\n');
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
console.log('3. Supabase URL - for database access');
console.log('   Sign up at: https://supabase.com and create a new project\n');
console.log('4. Supabase Anon Key - for database access');
console.log('   Available in your Supabase project under Settings > API\n');

const askForKey = (name, existingValue, description, url) => {
  return new Promise((resolve) => {
    const defaultValue = existingValue && existingValue !== 'YOUR_KEY' ? existingValue : '';
    
    console.log(`\n🔑 ${name} Key:`);
    if (description) console.log(description);
    if (url) console.log(`Get one at: ${url}`);
    
    rl.question(`Enter your ${name}${defaultValue ? ` (current: ${defaultValue.slice(0, 4)}...${defaultValue.slice(-4)})` : ''}: `, (answer) => {
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
    
    // Ask for Supabase URL
    const supabaseUrl = await askForKey(
      'Supabase URL', 
      existingEnv.NEXT_PUBLIC_SUPABASE_URL,
      'Your Supabase project URL',
      'https://supabase.com'
    );
    
    // Ask for Supabase Anon Key
    const supabaseAnonKey = await askForKey(
      'Supabase Anon Key', 
      existingEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Your Supabase project anon/public key',
      'https://supabase.com'
    );
    
    // Prepare the .env file content
    const envContent = `# Blockchain Provider API Keys
INFURA_API_KEY=${infuraKey}
ETHERSCAN_API_KEY=${etherscanKey}

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey}

# App URL for CORS
NEXT_PUBLIC_APP_URL=${existingEnv.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}
NEXT_PUBLIC_WS_URL=${existingEnv.NEXT_PUBLIC_WS_URL || '/api/socket'}
`;
    
    // Write to the .env file
    fs.writeFileSync(ENV_FILE, envContent);
    
    console.log('\n✅ API keys have been saved to .env.local');
    console.log('\n🔍 Next Steps:');
    console.log('1. Set up your Supabase database tables (see README.md for instructions)');
    console.log('2. Start your application with: npm run dev');
    
  } catch (error) {
    console.error('\n❌ Error setting up keys:', error);
  } finally {
    rl.close();
  }
};

main(); 