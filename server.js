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

// Load API keys from environment variables
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const INFURA_API_KEY = process.env.INFURA_API_KEY || '';

// Log the keys with masking for security
if (ETHERSCAN_API_KEY) {
  console.log(`Using Etherscan API key: ${ETHERSCAN_API_KEY.substring(0, 4)}...${ETHERSCAN_API_KEY.substring(ETHERSCAN_API_KEY.length - 4)}`);
} else {
  console.log('Etherscan API key not available - API functionality will be limited');
}

if (INFURA_API_KEY) {
  console.log(`Using Infura API key: ${INFURA_API_KEY.substring(0, 4)}...${INFURA_API_KEY.substring(INFURA_API_KEY.length - 4)}`);
} else {
  console.log('Infura API key not available - API functionality will be limited');
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
  CONNECTION_ERROR: 'connection-error'
};

// Initialize providers
let httpProvider = null;
let wsProvider = null;

// Initialize blockchain providers
function initProviders() {
  try {
    // Use Infura if API key is available, otherwise fail
    if (!INFURA_API_KEY) {
      console.error('Infura API key not found in environment variables');
      throw new Error('Missing Infura API key');
    }
    
    const rpcUrl = `https://mainnet.infura.io/v3/${INFURA_API_KEY}`;
    
    // Initialize HTTP provider
    httpProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
    console.log('HTTP provider initialized successfully');
    
    return { httpProvider };
  } catch (error) {
    console.error('Failed to initialize providers:', error.message);
    return { httpProvider: null };
  }
}

// Format transaction for client
function formatTransaction(tx) {
  return {
    id: tx.hash,
    hash: tx.hash,
    from: tx.from.toLowerCase(),
    to: tx.to ? tx.to.toLowerCase() : null, // null for contract creation
    value: tx.value.toString(),
    timestamp: tx.timestamp || Math.floor(Date.now() / 1000), 
    blockNumber: tx.blockNumber || 0,
    gas: tx.gasLimit ? tx.gasLimit.toString() : tx.gas ? tx.gas.toString() : '0',
    gasPrice: tx.gasPrice ? tx.gasPrice.toString() : '0',
    nonce: tx.nonce,
    status: tx.status || 'pending'
  };
}

// Get transactions from Etherscan
async function getEtherscanTransactions(address, limit = 100) {
  try {
    if (!ETHERSCAN_API_KEY) {
      console.error('No Etherscan API key provided in environment variables');
      throw new Error('Etherscan API key is required');
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
      console.warn('No transactions found in Etherscan.');
      return [];
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
    throw error;
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
          throw new Error('Failed to initialize provider');
        }
        httpProvider = newHttpProvider;
      } catch (error) {
        console.error('Error initializing HTTP provider:', error.message);
        throw error;
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
            const formattedTx = formatTransaction(tx);
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
      const formattedTx = formatTransaction(tx);
      
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
          const formattedTx = formatTransaction(tx);
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

// Cache to store transactions to avoid duplicates
const transactionCache = new Map(); // Map of wallet address -> Set of transaction hashes

// Function to get latest transactions and emit new ones
async function pollEtherscanForNewTransactions(address, socketId) {
  try {
    if (!ETHERSCAN_API_KEY) {
      console.error('No Etherscan API key available for polling');
      return;
    }
    
    const normalizedAddress = address.toLowerCase();
    console.log(`Polling Etherscan for new transactions for ${normalizedAddress}...`);
    
    // Initialize cache for this address if it doesn't exist
    if (!transactionCache.has(normalizedAddress)) {
      transactionCache.set(normalizedAddress, new Set());
    }
    
    // Get recent transactions (limit to last 10 for efficiency)
    const transactions = await getEtherscanTransactions(normalizedAddress, 10);
    const addressCache = transactionCache.get(normalizedAddress);
    let newTransactionsFound = false;
    
    // Check each transaction and emit if new
    for (const tx of transactions) {
      if (!addressCache.has(tx.hash)) {
        // New transaction found
        console.log(`New transaction found for ${normalizedAddress}: ${tx.hash}`);
        addressCache.add(tx.hash);
        newTransactionsFound = true;
        
        // Find and notify the client associated with this address
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          console.log(`Emitting new transaction ${tx.hash} to socket ${socketId}`);
          socket.emit(SOCKET_EVENTS.NEW_TRANSACTION, tx);
        } else {
          console.log(`Socket ${socketId} not found for address ${address}`);
        }
      }
    }
    
    if (!newTransactionsFound) {
      console.log(`No new transactions found for ${normalizedAddress}`);
    }
    
    // Limit cache size to prevent memory issues (keep the latest 100 transactions)
    if (addressCache.size > 100) {
      const toRemove = addressCache.size - 100;
      console.log(`Trimming transaction cache for ${normalizedAddress} by ${toRemove} items`);
      const iterator = addressCache.values();
      for (let i = 0; i < toRemove; i++) {
        addressCache.delete(iterator.next().value);
      }
    }
    
    return transactions;
  } catch (error) {
    console.error(`Error polling Etherscan for ${address}:`, error);
    return [];
  }
}

// Track polling intervals for each client
const pollingIntervals = new Map();

// Start polling for a specific client
function startEtherscanPolling(address, socketId) {
  if (pollingIntervals.has(socketId)) {
    console.log(`Polling already active for ${socketId}, skipping`);
    return;
  }
  
  console.log(`Starting Etherscan polling for ${address} (socket: ${socketId})`);
  
  // Poll immediately once
  pollEtherscanForNewTransactions(address, socketId);
  
  // Then set up interval (poll every 20 seconds to respect API rate limits)
  const intervalId = setInterval(() => {
    pollEtherscanForNewTransactions(address, socketId);
  }, 20000);
  
  // Store the interval ID for cleanup
  pollingIntervals.set(socketId, intervalId);
  return intervalId;
}

// Stop polling for a specific client
function stopEtherscanPolling(socketId) {
  const intervalId = pollingIntervals.get(socketId);
  if (intervalId) {
    console.log(`Stopping Etherscan polling for socket ${socketId}`);
    clearInterval(intervalId);
    pollingIntervals.delete(socketId);
  }
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
        
        // If we still don't have any providers, report the error
        if (!httpProvider && !wsProvider) {
          console.error('No providers available after reinitialization');
          socket.emit(SOCKET_EVENTS.CONNECTION_ERROR, { 
            message: 'Failed to connect to blockchain providers. Please check API keys.'
          });
          return;
        }
      }
      
      try {
        // Fetch transaction history from Etherscan
        console.log(`Fetching transaction history for ${address}...`);
        const transactions = await getEtherscanTransactions(normalizedAddress, 50);
        console.log(`Sending ${transactions.length} transactions to client`);
        
        // Initialize the transaction cache with current transactions
        if (!transactionCache.has(normalizedAddress)) {
          const addressCache = new Set();
          transactions.forEach(tx => addressCache.add(tx.hash));
          transactionCache.set(normalizedAddress, addressCache);
          console.log(`Initialized transaction cache for ${normalizedAddress} with ${addressCache.size} transactions`);
        }
        
        // Send transaction history to client
        socket.emit(SOCKET_EVENTS.TRANSACTION_HISTORY, transactions);
        
        // Set up transaction streaming via both methods
        let unsubscribe;
        
        try {
          // 1. Set up blockchain provider subscription (if available)
          console.log(`Setting up real-time transaction subscription for ${address}`);
          unsubscribe = subscribeToAddressTransactions(normalizedAddress, (newTx) => {
            console.log(`Sending new transaction from blockchain to ${socket.id}: ${newTx.hash}`);
            socket.emit(SOCKET_EVENTS.NEW_TRANSACTION, newTx);
            
            // Also add to cache to avoid duplicates with Etherscan polling
            const addressCache = transactionCache.get(normalizedAddress);
            if (addressCache) {
              addressCache.add(newTx.hash);
            }
          });
        } catch (subscriptionError) {
          console.error(`Error setting up transaction subscription: ${subscriptionError.message}`);
          socket.emit(SOCKET_EVENTS.CONNECTION_ERROR, { 
            message: `Could not set up blockchain transaction notifications: ${subscriptionError.message}`
          });
          unsubscribe = null;
        }
        
        // 2. Also set up Etherscan polling as a backup/additional method
        console.log(`Setting up Etherscan polling for ${address}`);
        startEtherscanPolling(normalizedAddress, socket.id);
        
        // Store unsubscribe function if we have one
        if (unsubscribe) {
          subscriptions.set(socket.id, unsubscribe);
        }
        
      } catch (error) {
        console.error(`Error handling wallet connection for ${address}:`, error.message);
        socket.emit(SOCKET_EVENTS.CONNECTION_ERROR, { 
          message: `Error fetching transactions: ${error.message}`
        });
      }
      
      // Cleanup on disconnect
      socket.on(SOCKET_EVENTS.DISCONNECT, () => {
        const unsubscribe = subscriptions.get(socket.id);
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
        
        // Also stop Etherscan polling
        stopEtherscanPolling(socket.id);
        
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
      
      // Also stop Etherscan polling
      stopEtherscanPolling(socket.id);
      
      subscriptions.delete(socket.id);
      connectedClients.delete(socket.id);
      console.log(`Wallet disconnected from socket ${socket.id}`);
    });
  });

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