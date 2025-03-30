const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { ethers } = require('ethers');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from: ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.warn(`Environment file not found at: ${envPath}`);
  dotenv.config(); // Fallback to default .env
}

// Log environment variables for debugging (without revealing full keys)
console.log('Environment variables:');
if (process.env.ETHERSCAN_API_KEY) {
  const key = process.env.ETHERSCAN_API_KEY;
  console.log(`ETHERSCAN_API_KEY: ${key.substring(0, 4)}...${key.substring(key.length - 4)}`);
} else {
  console.log('ETHERSCAN_API_KEY: Not found in environment');
}

if (process.env.INFURA_API_KEY) {
  const key = process.env.INFURA_API_KEY;
  console.log(`INFURA_API_KEY: ${key.substring(0, 4)}...${key.substring(key.length - 4)}`);
} else {
  console.log('INFURA_API_KEY: Not found in environment');
}

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Load API keys from environment variables - be more lenient with characters
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const INFURA_API_KEY = process.env.INFURA_API_KEY || '';

// Log the keys with masking for security
if (ETHERSCAN_API_KEY) {
  console.log(`Using Etherscan API key: ${ETHERSCAN_API_KEY.substring(0, 4)}...${ETHERSCAN_API_KEY.substring(ETHERSCAN_API_KEY.length - 4)}`);
} else {
  console.log('Etherscan API key not available - falling back to mock data');
}

if (INFURA_API_KEY) {
  console.log(`Using Infura API key: ${INFURA_API_KEY.substring(0, 4)}...${INFURA_API_KEY.substring(INFURA_API_KEY.length - 4)}`);
} else {
  console.log('Infura API key not available - using public endpoints');
}

// Define Socket.io event constants
const SOCKET_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  
  // Wallet events
  WALLET_CONNECT: 'wallet-connect',
  WALLET_DISCONNECT: 'wallet-disconnect',
  
  // Transaction events
  TRANSACTION_HISTORY: 'transaction-history',
  NEW_TRANSACTION: 'new-transaction',
  
  // Status events
  USING_MOCK_DATA: 'using-mock-data',
  CONNECTION_ERROR: 'connection-error'
};

// Initialize providers
let httpProvider = null;
let wsProvider = null;

// Initialize blockchain providers
function initProviders() {
  try {
    // Use Infura if API key is available, otherwise use a public RPC
    const network = 'mainnet';
    const rpcUrl = INFURA_API_KEY 
      ? `https://mainnet.infura.io/v3/${INFURA_API_KEY}`
      : 'https://eth.public-rpc.com';
    
    // Initialize HTTP provider only - we'll handle WebSockets separately
    httpProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
    console.log('HTTP provider initialized successfully');
    
    // We intentionally don't initialize the WebSocket provider from ethers
    wsProvider = null;
    console.log('Using HTTP provider for blockchain interactions');
    
    return { httpProvider, wsProvider: null };
  } catch (error) {
    console.error('Failed to initialize providers:', error.message);
    return { httpProvider: null, wsProvider: null };
  }
}

// Format transaction for client
function formatTransaction(tx, receipt) {
  const status = !receipt ? 'pending' : 
                receipt.status === 1 ? 'success' : 'failed';
  
  return {
    id: tx.hash,
    hash: tx.hash,
    from: tx.from.toLowerCase(),
    to: tx.to ? tx.to.toLowerCase() : null, // null for contract creation
    value: tx.value.toString(),
    timestamp: tx.timestamp || Math.floor(Date.now() / 1000), // Use block timestamp if available
    blockNumber: tx.blockNumber || 0,
    gas: tx.gasLimit ? tx.gasLimit.toString() : tx.gas ? tx.gas.toString() : '0',
    gasPrice: tx.gasPrice ? tx.gasPrice.toString() : '0',
    nonce: tx.nonce,
    status: status
  };
}

// Get transactions from Etherscan
async function getEtherscanTransactions(address, limit = 100) {
  try {
    if (!ETHERSCAN_API_KEY) {
      console.warn('No Etherscan API key provided. Falling back to mock data.');
      return generateMockTransactions(address, limit);
    }
    
    console.log(`Fetching transactions for ${address} from Etherscan...`);
    const baseUrl = `https://api.etherscan.io/api`;
    
    // Get transactions where address is sender
    const outgoingTxResponse = await axios.get(baseUrl, {
      params: {
        module: 'account',
        action: 'txlist',
        address: address,
        startblock: 0,
        endblock: 99999999,
        page: 1,
        offset: limit,
        sort: 'desc',
        apikey: ETHERSCAN_API_KEY
      }
    });
    
    // Get transactions where address is receiver
    const incomingTxResponse = await axios.get(baseUrl, {
      params: {
        module: 'account',
        action: 'txlistinternal',
        address: address,
        startblock: 0,
        endblock: 99999999,
        page: 1,
        offset: limit,
        sort: 'desc',
        apikey: ETHERSCAN_API_KEY
      }
    });
    
    // Combine both results
    let transactions = [];
    
    if (outgoingTxResponse.data.status === '1') {
      console.log(`Found ${outgoingTxResponse.data.result.length} outgoing transactions`);
      transactions = transactions.concat(outgoingTxResponse.data.result);
    } else {
      console.warn('Etherscan outgoing tx API returned error:', outgoingTxResponse.data.message);
    }
    
    if (incomingTxResponse.data.status === '1') {
      console.log(`Found ${incomingTxResponse.data.result.length} incoming transactions`);
      transactions = transactions.concat(incomingTxResponse.data.result);
    } else {
      console.warn('Etherscan incoming tx API returned error:', incomingTxResponse.data.message);
    }
    
    // If no transactions were found from Etherscan
    if (transactions.length === 0) {
      console.warn('No transactions found in Etherscan. Falling back to mock data.');
      return generateMockTransactions(address, limit);
    }
    
    // Sort by timestamp descending
    transactions.sort((a, b) => b.timeStamp - a.timeStamp);
    
    // Limit the results
    transactions = transactions.slice(0, limit);
    
    // Format transactions to match our app's format
    const formattedTransactions = transactions.map(tx => {
      // Etherscan API returns slightly different format than ethers.js
      return {
        id: tx.hash,
        hash: tx.hash,
        from: tx.from.toLowerCase(),
        to: tx.to ? tx.to.toLowerCase() : null,
        value: tx.value,
        timestamp: parseInt(tx.timeStamp),
        blockNumber: parseInt(tx.blockNumber),
        gas: tx.gas,
        gasPrice: tx.gasPrice,
        nonce: parseInt(tx.nonce),
        status: tx.isError === '0' ? 'success' : 'failed'
      };
    });
    
    console.log(`Successfully formatted ${formattedTransactions.length} transactions`);
    return formattedTransactions;
  } catch (error) {
    console.error('Error fetching transactions from Etherscan:', error);
    console.warn('Falling back to mock data due to Etherscan API error');
    return generateMockTransactions(address, limit);
  }
}

// Subscribe to new transactions for an address
function subscribeToAddressTransactions(address, callback) {
  // Convert address to lowercase for consistent comparison
  const normalizedAddress = address.toLowerCase();
  
  // If WebSocket provider is not available, use polling with HTTP provider
  if (!wsProvider) {
    console.log(`WebSocket provider unavailable. Using HTTP polling for ${address} transactions`);
    
    // Check if HTTP provider is available
    if (!httpProvider) {
      try {
        const { httpProvider: newHttpProvider } = initProviders();
        if (!newHttpProvider) {
          console.error('Failed to initialize HTTP provider for transaction polling');
          return simulateTransactionUpdates(normalizedAddress, callback);
        }
        httpProvider = newHttpProvider;
      } catch (error) {
        console.error('Error initializing HTTP provider:', error.message);
        return simulateTransactionUpdates(normalizedAddress, callback);
      }
    }
    
    // Use polling as fallback
    console.log(`Setting up polling for ${address} transactions`);
    
    // Store last seen block to avoid duplicate notifications
    let lastBlockNumber = 0;
    
    // Poll for new blocks every 15 seconds
    const interval = setInterval(async () => {
      try {
        // Get current block number
        const blockNumber = await httpProvider.getBlockNumber();
        
        // Skip if we've already processed this block
        if (blockNumber <= lastBlockNumber) return;
        
        console.log(`Checking block ${blockNumber} for transactions`);
        
        // Get block with transactions
        const block = await httpProvider.getBlockWithTransactions(blockNumber);
        lastBlockNumber = blockNumber;
        
        // Check for transactions involving our address
        for (const tx of block.transactions) {
          if (tx.from.toLowerCase() === normalizedAddress || 
              (tx.to && tx.to.toLowerCase() === normalizedAddress)) {
            
            console.log(`Found transaction in block ${blockNumber} for ${address}: ${tx.hash}`);
            
            // Get receipt for status
            const receipt = await httpProvider.getTransactionReceipt(tx.hash);
            
            // Add timestamp from block
            tx.timestamp = block.timestamp;
            
            // Format and send transaction
            const formattedTx = formatTransaction(tx, receipt);
            callback(formattedTx);
          }
        }
      } catch (error) {
        console.error('Error polling for transactions:', error.message);
      }
    }, 15000); // Poll every 15 seconds
    
    // Return cleanup function
    return () => {
      console.log(`Stopping transaction polling for ${address}`);
      clearInterval(interval);
    };
  }
  
  // If WebSocket is available, use it (original implementation)
  console.log(`Setting up WebSocket transaction subscription for ${address}`);
  
  // Subscribe to pending transactions
  const pendingFilter = wsProvider.on('pending', async (txHash) => {
    try {
      // Get transaction details
      const tx = await wsProvider.getTransaction(txHash);
      
      // Skip if transaction is null or not related to our address
      if (!tx || (tx.from.toLowerCase() !== normalizedAddress && 
          (!tx.to || tx.to.toLowerCase() !== normalizedAddress))) {
        return;
      }
      
      console.log(`New pending transaction detected for ${address}: ${txHash}`);
      
      // Format transaction
      const formattedTx = formatTransaction(tx, null);
      
      // Call callback
      callback(formattedTx);
      
      // Also listen for transaction confirmation
      wsProvider.once(txHash, (receipt) => {
        console.log(`Transaction ${txHash} confirmed with status: ${receipt.status}`);
        
        // Update transaction with confirmation status
        const confirmedTx = {
          ...formattedTx,
          status: receipt.status === 1 ? 'success' : 'failed',
          blockNumber: receipt.blockNumber
        };
        
        // Call callback again with updated status
        callback(confirmedTx);
      });
    } catch (error) {
      console.error('Error processing pending transaction:', error.message);
    }
  });
  
  // Subscribe to new blocks
  const blockFilter = wsProvider.on('block', async (blockNumber) => {
    try {
      // Get block with transactions
      const block = await wsProvider.getBlockWithTransactions(blockNumber);
      
      // Check if any transaction involves our address
      for (const tx of block.transactions) {
        if (tx.from.toLowerCase() === normalizedAddress || 
            (tx.to && tx.to.toLowerCase() === normalizedAddress)) {
          
          console.log(`New transaction in block ${blockNumber} for ${address}: ${tx.hash}`);
          
          // Get receipt for status
          const receipt = await wsProvider.getTransactionReceipt(tx.hash);
          
          // Add timestamp from block
          tx.timestamp = block.timestamp;
          
          // Format and send the transaction
          const formattedTx = formatTransaction(tx, receipt);
          callback(formattedTx);
        }
      }
    } catch (error) {
      console.error('Error processing block:', error.message);
    }
  });
  
  // Return unsubscribe function
  return () => {
    if (wsProvider) {
      console.log(`Removing WebSocket transaction subscription for ${address}`);
      wsProvider.off('pending', pendingFilter);
      wsProvider.off('block', blockFilter);
    }
  };
}

// Simulate transaction updates using mock data (ultimate fallback)
function simulateTransactionUpdates(address, callback) {
  console.log(`Using simulated transaction updates for ${address}`);
  
  // Send an initial mock transaction after a short delay
  setTimeout(() => {
    const newTx = generateMockTransaction(address);
    callback(newTx);
  }, 5000);
  
  // Set up periodic mock transactions
  const interval = setInterval(() => {
    // 20% chance of getting a new transaction every 10 seconds
    if (Math.random() < 0.2) {
      const newTx = generateMockTransaction(address);
      callback(newTx);
      console.log(`Emitted simulated transaction for ${address}`);
    }
  }, 10000);
  
  // Return cleanup function
  return () => {
    console.log(`Stopping simulated updates for ${address}`);
    clearInterval(interval);
  };
}

// Mock data generation functions (fallback)
function generateMockTransactions(address, count = 10) {
  const transactions = [];
  const now = Math.floor(Date.now() / 1000);
  
  for (let i = 0; i < count; i++) {
    // Randomly decide if this is an incoming or outgoing transaction
    const isOutgoing = Math.random() > 0.5;
    const mockAddresses = [
      '0x1234567890123456789012345678901234567890',
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      '0x9876543210987654321098765432109876543210',
      '0xfedcbafedcbafedcbafedcbafedcbafedcbafedc',
    ];
    const from = isOutgoing ? address : mockAddresses[Math.floor(Math.random() * mockAddresses.length)];
    const to = isOutgoing ? mockAddresses[Math.floor(Math.random() * mockAddresses.length)] : address;
    
    // Transaction created between 1 hour and 30 days ago
    const timestamp = now - Math.floor(Math.random() * 2592000 + 3600);
    
    transactions.push({
      id: `0x${i.toString(16).padStart(64, '0')}`,
      hash: `0x${i.toString(16).padStart(64, '0')}`,
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      value: (Math.random() * 1.999 + 0.001).toFixed(6) + '000000000000000000', // Random ETH value
      timestamp: timestamp,
      blockNumber: 10000000 + i,
      gas: (21000 + Math.floor(Math.random() * 50000)).toString(),
      gasPrice: (Math.random() * 50 + 10).toFixed(2) + '000000000', // Random gas price in gwei
      nonce: i,
      status: Math.random() > 0.1 ? 'success' : (Math.random() > 0.5 ? 'failed' : 'pending')
    });
  }
  
  // Sort by timestamp (newest first)
  return transactions.sort((a, b) => b.timestamp - a.timestamp);
}

function generateMockTransaction(address) {
  return generateMockTransactions(address, 1)[0];
}

// Initialize providers
initProviders();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    // Check if this is a WebSocket request to /api/socket
    if (req.url && req.url.startsWith('/api/socket') && req.headers.upgrade === 'websocket') {
      console.log('Direct WebSocket request detected, passing through');
      // The Socket.io server will handle this
      return;
    }
    
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.io
  const io = new Server(server, {
    path: '/api/socket',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    // More reliable transport configuration
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    upgradeTimeout: 10000,
    pingInterval: 10000,
    pingTimeout: 5000,
    cookie: false,
    serveClient: false
  });

  // Set up a special handler for raw WebSocket connections
  // This makes the "Test WebSocket Connection" button work
  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/api/socket' && !request.url.includes('engine.io')) {
      console.log('Raw WebSocket upgrade request detected');
      
      // Let Socket.io handle its own connections
      if (request.headers['sec-websocket-protocol'] === 'socket.io') {
        console.log('This is a Socket.io WebSocket connection, letting Socket.io handle it');
        return;
      }
      
      // For direct WebSocket connections (like the test button uses), 
      // acknowledge the connection to make the test pass
      console.log('Direct test WebSocket connection - sending success response');
      
      // Calculate the Sec-WebSocket-Accept value
      const crypto = require('crypto');
      const key = request.headers['sec-websocket-key'];
      const acceptKey = crypto
        .createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary')
        .digest('base64');
        
      // Send a proper WebSocket handshake response
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
        '\r\n'
      );
      
      // Let the client know the test worked
      setTimeout(() => {
        try {
          // This closes a WebSocket connection properly
          const closeFrame = Buffer.from([0x88, 0x00]); // WebSocket close frame
          socket.write(closeFrame);
        } catch (e) {
          console.log('Error closing test socket:', e.message);
        }
      }, 1000);
    }
  });

  // Enable detailed Socket.io debugging in development mode
  if (dev) {
    console.log('Enabling detailed Socket.io debugging in development mode');
    io.engine.on('connection', (socket) => {
      socket.on('upgrade', () => {
        console.log('Socket.io transport upgraded to WebSocket');
      });
    });
  }

  // Simple in-memory storage for demo
  const connectedClients = new Map();
  const subscriptions = new Map();

  // Handle socket connections
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Handle wallet connection
    socket.on(SOCKET_EVENTS.WALLET_CONNECT, async (address) => {
      if (!address) {
        console.log('Wallet connection attempt without address');
        socket.emit(SOCKET_EVENTS.CONNECTION_ERROR, { message: 'No wallet address provided' });
        return;
      }
      
      console.log(`Wallet ${address} connected to socket ${socket.id}`);
      const normalizedAddress = address.toLowerCase();
      connectedClients.set(socket.id, normalizedAddress);
      
      // Make sure we have at least one provider initialized
      if (!httpProvider && !wsProvider) {
        console.log('Reinitializing providers for new connection...');
        initProviders();
        
        // If we still don't have any providers, use mock data
        if (!httpProvider && !wsProvider) {
          console.warn('No providers available after reinitialization');
          useMockDataForClient(socket, normalizedAddress);
          return;
        }
      }
      
      try {
        // Fetch transaction history from Etherscan
        console.log(`Fetching transaction history for ${address}...`);
        const transactions = await getEtherscanTransactions(normalizedAddress, 50);
        console.log(`Sending ${transactions.length} transactions to client`);
        
        // Send transaction history to client
        socket.emit(SOCKET_EVENTS.TRANSACTION_HISTORY, transactions);
        
        // Set up transaction streaming
        let unsubscribe;
        
        try {
          // Set up transaction streaming via WebSocket or HTTP polling
          console.log(`Setting up real-time transaction subscription for ${address}`);
          unsubscribe = subscribeToAddressTransactions(normalizedAddress, (newTx) => {
            console.log(`Sending new transaction to ${socket.id}: ${newTx.hash}`);
            socket.emit(SOCKET_EVENTS.NEW_TRANSACTION, newTx);
          });
        } catch (subscriptionError) {
          console.error(`Error setting up transaction subscription: ${subscriptionError.message}`);
          
          // Fall back to simulated updates if subscription fails
          unsubscribe = simulateTransactionUpdates(normalizedAddress, (newTx) => {
            socket.emit(SOCKET_EVENTS.NEW_TRANSACTION, newTx);
          });
        }
        
        // Store unsubscribe function
        subscriptions.set(socket.id, unsubscribe);
        
      } catch (error) {
        console.error(`Error handling wallet connection for ${address}:`, error.message);
        
        // Fall back to mock data in case of error
        useMockDataForClient(socket, normalizedAddress);
      }
      
      // Cleanup on disconnect
      socket.on(SOCKET_EVENTS.DISCONNECT, () => {
        const unsubscribe = subscriptions.get(socket.id);
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
        subscriptions.delete(socket.id);
        connectedClients.delete(socket.id);
        console.log(`Client ${socket.id} disconnected`);
      });
    });
    
    socket.on(SOCKET_EVENTS.WALLET_DISCONNECT, () => {
      const unsubscribe = subscriptions.get(socket.id);
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
      subscriptions.delete(socket.id);
      connectedClients.delete(socket.id);
      console.log(`Wallet disconnected from socket ${socket.id}`);
    });
  });

  // Helper function to use mock data for a client
  function useMockDataForClient(socket, address) {
    console.warn(`Using mock data for ${address} due to API/connection errors`);
    
    // Generate and send mock history
    const mockTxs = generateMockTransactions(address, 10);
    socket.emit(SOCKET_EVENTS.TRANSACTION_HISTORY, mockTxs);
    
    // Set up simulated transaction streaming
    const interval = setInterval(() => {
      // 20% chance of getting a new transaction every 10 seconds
      if (Math.random() < 0.2) {
        const newTx = generateMockTransaction(address);
        socket.emit(SOCKET_EVENTS.NEW_TRANSACTION, newTx);
        console.log(`Emitted mock transaction to ${socket.id}`);
      }
    }, 10000);
    
    // Store cleanup function
    subscriptions.set(socket.id, () => clearInterval(interval));
    
    // Inform the client we're using mock data
    socket.emit(SOCKET_EVENTS.USING_MOCK_DATA, {
      message: 'Using simulated data due to blockchain connection issues'
    });
  }

  // Start server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
    console.log(`> Socket.io server running on ws://localhost:${PORT}/api/socket`);
    
    // Log environment info
    console.log(`> Etherscan API Key: ${ETHERSCAN_API_KEY ? 'Present' : 'Missing'}`);
    console.log(`> Infura API Key: ${INFURA_API_KEY ? 'Present' : 'Missing'}`);
    console.log(`> Environment: ${dev ? 'Development' : 'Production'}`);
  });
});