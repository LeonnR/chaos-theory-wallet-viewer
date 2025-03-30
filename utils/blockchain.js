import { ethers } from 'ethers';
import axios from 'axios';
import { NETWORKS, DEFAULT_NETWORK, MAX_TRANSACTIONS } from '@/app/blockchain-config';

// Create Ethereum providers
let httpProvider = null;
let wsProvider = null;

// Ensure we have access to API keys
const getInfuraKey = () => process.env.INFURA_API_KEY || '';
const getEtherscanKey = () => process.env.ETHERSCAN_API_KEY || '';

/**
 * Initialize the blockchain providers
 * @param {object} network - Network configuration object
 */
export async function initProviders(network = DEFAULT_NETWORK) {
  try {
    console.log('Initializing providers with network:', network.name);
    
    // Check if we have the necessary API keys
    const infuraKey = getInfuraKey();
    if (!infuraKey || infuraKey.length === 0) {
      console.error('Cannot initialize providers: Missing Infura API key in environment variables');
      throw new Error('Missing Infura API key');
    }
    
    // Initialize HTTP provider with the API key
    const rpcUrl = network.rpcUrl.replace(/{INFURA_API_KEY}|YOUR_INFURA_API_KEY/, infuraKey);
    console.log('Using RPC URL:', rpcUrl.replace(infuraKey, '****'));
    
    // Initialize HTTP provider
    httpProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Test the provider
    const blockNumber = await httpProvider.getBlockNumber();
    console.log(`Successfully connected to Ethereum network. Current block: ${blockNumber}`);
    
    return { httpProvider, wsProvider: null };
  } catch (error) {
    console.error('Failed to initialize providers:', error.message);
    throw error;
  }
}

/**
 * Format transaction data 
 * @param {object} tx - Transaction object
 * @returns {object} - Formatted transaction
 */
export function formatTransaction(tx) {
  return {
    hash: tx.hash,
    from: tx.from.toLowerCase(),
    to: tx.to ? tx.to.toLowerCase() : null, // null for contract creation
    value: tx.value,
    timestamp: tx.timeStamp || Math.floor(Date.now() / 1000),
    blockNumber: tx.blockNumber || 0,
    gas: tx.gas || '0',
    gasPrice: tx.gasPrice || '0',
    nonce: tx.nonce || 0,
    status: tx.status || 'success'
  };
}

/**
 * Get historical transactions for an address directly from Etherscan
 * @param {string} address - Ethereum address
 * @param {number} limit - Maximum number of transactions to fetch
 * @returns {Promise<Object>} - Object containing transactions array and error message if any
 */
export async function getAddressTransactions(address, limit = MAX_TRANSACTIONS) {
  console.log(`Fetching transactions for ${address}, limit: ${limit}`);
  
  // Check for Etherscan API key
  const etherscanKey = getEtherscanKey();
  if (!etherscanKey || etherscanKey.length === 0) {
    console.error('No Etherscan API key provided in environment variables');
    return {
      transactions: [],
      error: 'Etherscan API key is required to fetch transaction history'
    };
  }
  
  try {
    // Use Etherscan API to get transactions
    // Default to mainnet
    const baseUrl = 'https://api.etherscan.io/api';
    console.log(`Using Etherscan API: ${baseUrl}`);
    
    // Get outgoing transactions (where address is sender)
    const outgoingResponse = await axios.get(baseUrl, {
      params: {
        module: 'account',
        action: 'txlist',
        address: address,
        startblock: 0,
        endblock: 99999999,
        page: 1,
        offset: limit,
        sort: 'desc',
        apikey: etherscanKey
      }
    });
    
    // Get incoming transactions (internal transactions where address is receiver)
    const incomingResponse = await axios.get(baseUrl, {
      params: {
        module: 'account',
        action: 'txlistinternal',
        address: address,
        startblock: 0,
        endblock: 99999999,
        page: 1,
        offset: limit,
        sort: 'desc',
        apikey: etherscanKey
      }
    });
    
    let transactions = [];
    
    // Process outgoing transactions
    if (outgoingResponse.data.status === '1') {
      console.log(`Found ${outgoingResponse.data.result.length} outgoing transactions`);
      transactions = transactions.concat(outgoingResponse.data.result);
    } else {
      console.warn('Etherscan outgoing tx API returned:', outgoingResponse.data.message);
    }
    
    // Process incoming transactions
    if (incomingResponse.data.status === '1') {
      console.log(`Found ${incomingResponse.data.result.length} incoming transactions`);
      transactions = transactions.concat(incomingResponse.data.result);
    } else {
      console.warn('Etherscan incoming tx API returned:', incomingResponse.data.message);
    }
    
    // If no transactions found
    if (transactions.length === 0) {
      return {
        transactions: [],
        error: 'No transactions found for this address'
      };
    }
    
    // Sort by timestamp descending
    transactions.sort((a, b) => b.timeStamp - a.timeStamp);
    
    // Limit the results
    transactions = transactions.slice(0, limit);
    
    // Format transactions
    const formattedTransactions = transactions.map(tx => formatTransaction(tx));
    
    console.log(`Returning ${formattedTransactions.length} transactions for ${address}`);
    return {
      transactions: formattedTransactions,
      error: null
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return {
      transactions: [],
      error: `Failed to fetch transactions: ${error.message}`
    };
  }
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
      const formattedTx = formatTransaction(tx);
      
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
          const formattedTx = formatTransaction(tx);
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