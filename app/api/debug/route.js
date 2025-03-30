import { NextResponse } from 'next/server';
import { INFURA_API_KEY, ETHERSCAN_API_KEY } from '@/app/blockchain-config';

export async function GET() {
  // Check API keys (mask most of the key for security)
  const infuraKeyStatus = INFURA_API_KEY ? 
    `Present: ${INFURA_API_KEY.substring(0, 4)}...${INFURA_API_KEY.substring(INFURA_API_KEY.length - 4)}` : 
    'Missing';
  
  const etherscanKeyStatus = ETHERSCAN_API_KEY ? 
    `Present: ${ETHERSCAN_API_KEY.substring(0, 4)}...${ETHERSCAN_API_KEY.substring(ETHERSCAN_API_KEY.length - 4)}` : 
    'Missing';
  
  // Check environment variables
  const envVars = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'Missing',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'Missing',
    NODE_ENV: process.env.NODE_ENV || 'Missing',
  };
  
  // Return diagnostic information
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiKeys: {
      infura: infuraKeyStatus,
      etherscan: etherscanKeyStatus,
    },
    environment: envVars
  });
} 