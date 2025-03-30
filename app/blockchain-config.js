// Blockchain Configuration

// You can get a free Infura API key from https://infura.io
export const INFURA_API_KEY = process.env.INFURA_API_KEY || '';

// Check if Infura API key is available
const hasInfuraKey = INFURA_API_KEY && INFURA_API_KEY !== 'YOUR_INFURA_API_KEY';

// Network configurations
export const NETWORKS = {
  MAINNET: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: hasInfuraKey 
      ? `https://mainnet.infura.io/v3/${INFURA_API_KEY}`
      : 'https://eth.public-rpc.com',
    wsUrl: hasInfuraKey 
      ? `wss://mainnet.infura.io/ws/v3/${INFURA_API_KEY}`
      : 'wss://eth.public-rpc.com',
    blockExplorer: 'https://etherscan.io'
  },
  GOERLI: {
    name: 'Goerli Testnet',
    chainId: 5,
    rpcUrl: hasInfuraKey 
      ? `https://goerli.infura.io/v3/${INFURA_API_KEY}`
      : 'https://goerli.infura.io/v3/',
    wsUrl: hasInfuraKey 
      ? `wss://goerli.infura.io/ws/v3/${INFURA_API_KEY}`
      : 'wss://goerli.infura.io/ws/v3/',
    blockExplorer: 'https://goerli.etherscan.io'
  },
  SEPOLIA: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: hasInfuraKey 
      ? `https://sepolia.infura.io/v3/${INFURA_API_KEY}`
      : 'https://sepolia.infura.io/v3/',
    wsUrl: hasInfuraKey 
      ? `wss://sepolia.infura.io/ws/v3/${INFURA_API_KEY}`
      : 'wss://sepolia.infura.io/ws/v3/',
    blockExplorer: 'https://sepolia.etherscan.io'
  }
};

// Default network to use
export const DEFAULT_NETWORK = NETWORKS.MAINNET;

// Etherscan API key for extended transaction data (optional)
export const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';

// Maximum number of transactions to fetch at once
export const MAX_TRANSACTIONS = 100;

// Number of confirmations to consider a transaction as confirmed
export const CONFIRMATIONS_THRESHOLD = 12; 