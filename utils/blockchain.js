import { ethers } from 'ethers';
import axios from 'axios';
import { NETWORKS, DEFAULT_NETWORK, ETHERSCAN_API_KEY, MAX_TRANSACTIONS } from '@/app/blockchain-config';

// Create Ethereum providers
let httpProvider = null;
let wsProvider = null;

/**
 * Initialize the blockchain providers
 * @param {object} network - Network configuration object
 */
export function initProviders(network = DEFAULT_NETWORK) {
  // Initialize HTTP provider
  httpProvider = new ethers.providers.JsonRpcProvider(network.rpcUrl);
  
  // Initialize WebSocket provider
  wsProvider = new ethers.providers.WebSocketProvider(network.wsUrl);
  
  // Set up automatic reconnection for WebSocket
  wsProvider._websocket.on('close', () => {
    console.log('WebSocket connection closed. Reconnecting...');
    setTimeout(() => {
      wsProvider = new ethers.providers.WebSocketProvider(network.wsUrl);
    }, 3000);
  });
  
  return { httpProvider, wsProvider };
}

/**
 * Get transaction receipt with status
 * @param {string} txHash - Transaction hash
 * @returns {Promise<object>} - Transaction receipt
 */
export async function getTransactionReceipt(txHash) {
  if (!httpProvider) initProviders();
  return await httpProvider.getTransactionReceipt(txHash);
}

/**
 * Format transaction data to match our application's format
 * @param {object} tx - Transaction object from ethers.js
 * @param {object} receipt - Transaction receipt object
 * @returns {object} - Formatted transaction
 */
export function formatTransaction(tx, receipt) {
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
    gas: tx.gasLimit.toString(),
    gasPrice: tx.gasPrice.toString(),
    nonce: tx.nonce,
    status: status
  };
}

// Add a function to generate mock transaction data for testing
export function generateMockTransactions(address, count = 10) {
  const mockAddresses = [
    '0x1234567890123456789012345678901234567890',
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    '0x9876543210987654321098765432109876543210',
    '0xfedcbafedcbafedcbafedcbafedcbafedcbafedc',
    address,
  ];

  const transactions = [];
  const now = Math.floor(Date.now() / 1000);
  
  for (let i = 0; i < count; i++) {
    // Randomly decide if this is an incoming or outgoing transaction
    const isOutgoing = Math.random() > 0.5;
    const from = isOutgoing ? address : mockAddresses[Math.floor(Math.random() * (mockAddresses.length - 1))];
    const to = isOutgoing ? mockAddresses[Math.floor(Math.random() * (mockAddresses.length - 1))] : address;
    
    // Random ETH value between 0.001 and 2 ETH
    const value = ethers.utils.parseEther(
      (Math.random() * 1.999 + 0.001).toFixed(6)
    ).toString();
    
    // Transaction created between 1 hour and 30 days ago
    const timestamp = now - Math.floor(Math.random() * 2592000 + 3600);
    
    transactions.push({
      id: `0x${i.toString(16).padStart(64, '0')}`,
      hash: `0x${i.toString(16).padStart(64, '0')}`,
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      value: value,
      timestamp: timestamp,
      blockNumber: 10000000 + i,
      gas: (21000 + Math.floor(Math.random() * 50000)).toString(),
      gasPrice: ethers.utils.parseUnits((Math.random() * 50 + 10).toFixed(2), 'gwei').toString(),
      nonce: i,
      status: Math.random() > 0.1 ? 'success' : (Math.random() > 0.5 ? 'failed' : 'pending')
    });
  }
  
  // Sort by timestamp (newest first)
  return transactions.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Get historical transactions for an address
 * @param {string} address - Ethereum address
 * @param {number} limit - Maximum number of transactions to fetch
 * @returns {Promise<Array>} - Array of formatted transactions
 */
export async function getAddressTransactions(address, limit = MAX_TRANSACTIONS) {
  if (!httpProvider) {
    try {
      initProviders();
    } catch (err) {
      console.error('Failed to initialize providers:', err);
      // Return mock data since we can't connect
      console.warn('Using mock transaction data due to provider initialization failure');
      return generateMockTransactions(address, limit);
    }
  }
  
  try {
    // For complete transaction history, we need to use Etherscan API
    // Infura doesn't provide a direct way to get all transactions for an address
    if (ETHERSCAN_API_KEY && ETHERSCAN_API_KEY.length > 0) {
      try {
        const network = httpProvider.network.name === 'homestead' ? '' : `-${httpProvider.network.name}`;
        const baseUrl = `https://api${network}.etherscan.io/api`;
        
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
          transactions = transactions.concat(outgoingTxResponse.data.result);
        } else {
          console.warn('Etherscan outgoing tx API returned error:', outgoingTxResponse.data.message);
        }
        
        if (incomingTxResponse.data.status === '1') {
          transactions = transactions.concat(incomingTxResponse.data.result);
        } else {
          console.warn('Etherscan incoming tx API returned error:', incomingTxResponse.data.message);
        }
        
        // If no transactions were found from Etherscan
        if (transactions.length === 0) {
          console.warn('No transactions found in Etherscan. Falling back to alternative methods.');
          // Try the fallback method
          return await getFallbackTransactions(address, limit);
        }
        
        // Sort by timestamp descending
        transactions.sort((a, b) => b.timeStamp - a.timeStamp);
        
        // Limit the results
        transactions = transactions.slice(0, limit);
        
        // Format transactions to match our app's format
        const formattedTransactions = await Promise.all(
          transactions.map(async (tx) => {
            try {
              // Etherscan API returns slightly different format than ethers.js
              const formattedTx = {
                hash: tx.hash,
                from: tx.from.toLowerCase(),
                to: tx.to ? tx.to.toLowerCase() : null,
                value: ethers.BigNumber.from(tx.value).toString(),
                blockNumber: parseInt(tx.blockNumber),
                timestamp: parseInt(tx.timeStamp),
                gasLimit: ethers.BigNumber.from(tx.gas),
                gasPrice: ethers.BigNumber.from(tx.gasPrice),
                nonce: parseInt(tx.nonce)
              };
              
              const receipt = await getTransactionReceipt(tx.hash);
              return formatTransaction(formattedTx, receipt);
            } catch (err) {
              console.error('Error formatting transaction:', err);
              // Skip this transaction if there's an error
              return null;
            }
          })
        );
        
        // Filter out null transactions (those that had errors)
        const validTransactions = formattedTransactions.filter(tx => tx !== null);
        
        if (validTransactions.length === 0) {
          console.warn('All transactions failed to format. Falling back to alternative methods.');
          return await getFallbackTransactions(address, limit);
        }
        
        return validTransactions;
      } catch (etherscanError) {
        console.error('Etherscan API error:', etherscanError);
        // If Etherscan fails, try the fallback
        return await getFallbackTransactions(address, limit);
      }
    } else {
      // No Etherscan API key provided
      return await getFallbackTransactions(address, limit);
    }
  } catch (error) {
    console.error('Error fetching transactions:', error);
    // Return mock data as a last resort
    console.warn('All methods failed. Returning mock transaction data.');
    return generateMockTransactions(address, limit);
  }
}

/**
 * Fallback method to get transactions when Etherscan is not available
 */
async function getFallbackTransactions(address, limit) {
  try {
    console.warn('No Etherscan API key provided or API failed. Fetching limited transaction history.');
    
    // Get current block number
    const blockNumber = await httpProvider.getBlockNumber();
    
    // Get recent blocks (last 10 blocks)
    const blocks = await Promise.all(
      Array.from({ length: 10 }, (_, i) => 
        httpProvider.getBlockWithTransactions(blockNumber - i)
      )
    );
    
    // Filter transactions related to the address
    const transactions = blocks
      .flatMap(block => block.transactions)
      .filter(tx => 
        tx.from.toLowerCase() === address.toLowerCase() || 
        (tx.to && tx.to.toLowerCase() === address.toLowerCase())
      );
    
    // Format transactions
    const formattedTransactions = await Promise.all(
      transactions.map(async (tx) => {
        try {
          const receipt = await getTransactionReceipt(tx.hash);
          // Add timestamp from block
          const block = await httpProvider.getBlock(tx.blockNumber);
          tx.timestamp = block.timestamp;
          return formatTransaction(tx, receipt);
        } catch (err) {
          console.error('Error formatting transaction:', err);
          return null;
        }
      })
    );
    
    // Filter out null transactions
    const validTransactions = formattedTransactions.filter(tx => tx !== null);
    
    if (validTransactions.length === 0) {
      console.warn('No transactions found via blockchain provider. Using mock data.');
      return generateMockTransactions(address, limit);
    }
    
    return validTransactions;
  } catch (error) {
    console.error('Error in fallback transaction fetching:', error);
    // Return mock data as a last resort
    return generateMockTransactions(address, limit);
  }
}

/**
 * Subscribe to new transactions for an address
 * @param {string} address - Ethereum address to monitor
 * @param {function} callback - Callback function to call when new transaction is detected
 * @returns {function} - Unsubscribe function
 */
export function subscribeToAddressTransactions(address, callback) {
  if (!wsProvider) initProviders();
  
  // Convert address to lowercase for consistent comparison
  const normalizedAddress = address.toLowerCase();
  
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
      
      // Format transaction
      const formattedTx = formatTransaction(tx, null);
      
      // Call callback
      callback(formattedTx);
      
      // Also listen for transaction confirmation
      const confirmationFilter = wsProvider.once(txHash, (receipt) => {
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
      console.error('Error processing transaction:', error);
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
      console.error('Error processing block:', error);
    }
  });
  
  // Return unsubscribe function
  return () => {
    wsProvider.off('pending', pendingFilter);
    wsProvider.off('block', blockFilter);
  };
} 