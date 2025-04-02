# Wallet Transaction Viewer - Developer Documentation

## Project Overview

The Wallet Transaction Viewer is a real-time Ethereum wallet transaction monitoring application built with Next.js and Socket.io. It allows users to connect their wallets and view transaction history, tag addresses, and store tags in a database. 

## Screenshots

<p align="center">
  <img src="./images/wallet-connect.png" alt="Wallet Connection Screen" width="600" />
  <br>
  <em>Connect Wallet Interface</em>
</p>

<p align="center">
  <img src="./images/transaction-list.png" alt="Transaction List" width="600" />
  <br>
  <em>Transaction List View</em>
</p>

To add more screenshots, place your image files in the `docs/images` directory and reference them as shown above.

<!-- 
## Table of Contents

1. [Architecture](#architecture)
2. [Setup and Installation](#setup-and-installation)
3. [Key Features](#key-features)
4. [Frontend Implementation](#frontend-implementation)
5. [Backend Implementation](#backend-implementation)
6. [WebSocket Communication](#websocket-communication)
7. [Database Schema](#database-schema)
8. [API Reference](#api-reference)
9. [Troubleshooting](#troubleshooting)
10. [Deployment Guide](#deployment-guide) -->

## Architecture

### High-Level Architecture

The application follows a client-server architecture with real-time communication:

```
┌─────────────────┐       ┌────────────────┐        ┌────────────────┐
│                 │       │                │        │                │
│  React Frontend │◄──────►  Next.js API   │◄───────►  Socket.io     │
│  (Next.js)      │       │  Routes        │        │  Server        │
│                 │       │                │        │                │
└─────────────────┘       └────────────────┘        └───────┬────────┘
                                                           │
                                                           ▼
                                              ┌─────────────────────────┐
                                              │                         │
                                              │  Blockchain Providers   │
                                              │  - Etherscan API        │
                                              │  - Infura WebSockets    │
                                              │                         │
                                              └─────────────────────────┘
```

### Components

- **Frontend**: React/Next.js application with real-time updates via Socket.io-client
- **Backend**: 
  - Next.js API routes for data fetching
  - Socket.io for real-time communication
- **External Services**:
  - Etherscan API for historical transaction data
  - Infura for WebSocket connections to the Ethereum network
  - Supabase for database storage

## Setup and Installation

### Prerequisites

- Node.js 16+ and pnpm
- Etherscan API key - Get one from [Etherscan API Dashboard](https://etherscan.io/apidashboard)
- Infura API key - Get one from [Infura](https://developer.metamask.io/)
- Supabase account and project - Sign up at [Supabase](https://supabase.com/)

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/wallet-transaction-viewer.git
   cd wallet-transaction-viewer
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   pnpm create-env
   ```
   
   This interactive tool will help you set up the required API keys and configuration.

4. Start the Socket.io server:
   ```bash
   pnpm socket-server
   ```

5. In a separate terminal, start the Next.js development server:
   ```bash
   pnpm run dev
   ```

6. Open http://localhost:3001 in your browser.

## Key Features

### 1. Wallet Connection
- Integration with WalletConnect and Web3Modal
- Support for multiple wallet providers (MetaMask, Trust Wallet, etc.)
- Secure connection handling

### 2. Transaction History
- Retrieval of historical transactions from Etherscan
- Formatted transaction display with status indicators
- Pagination and filtering options

### 3. Real-Time Transaction Updates
- WebSocket connection to Ethereum network via Infura
- Polling mechanism for Etherscan updates (added as a fallback)
- Automatic transaction status updates

### 4. Address Tagging
- Custom tagging of Ethereum addresses
- Persistent storage of tags in Supabase
- Shared tags across sessions

## Frontend Implementation

### Key Components

#### `WalletConnect.tsx`
The wallet connection component that handles user authentication with Ethereum wallets.

#### `TransactionList.tsx`
Displays the list of transactions with filtering and sorting capabilities.

#### `app/page.tsx`
The main application page that orchestrates the components and handles socket connections.

### Socket Connection (Client-Side)

```javascript
// Excerpt from app/page.tsx
useEffect(() => {
  if (isConnected && address && socket) {
    // Remove previous listeners to avoid duplicates
    socket.off(SOCKET_EVENTS.TRANSACTION_HISTORY);
    socket.off(SOCKET_EVENTS.NEW_TRANSACTION);
    
    // Send wallet address to server
    socket.emit(SOCKET_EVENTS.WALLET_CONNECT, address);
    
    // Listen for initial transaction history
    socket.on(SOCKET_EVENTS.TRANSACTION_HISTORY, async (data: Transaction[]) => {
      console.log(`Received ${data.length} transactions from server`);
      setTransactions(data);
      setIsLoading(false);
    });
    
    // Listen for new transactions
    socket.on(SOCKET_EVENTS.NEW_TRANSACTION, async (newTransaction: Transaction) => {
      console.log('Received new transaction:', newTransaction.hash);
      setTransactions(prev => [newTransaction, ...prev]);
    });
  }
}, [isConnected, address, socket]);
```

### Handling Transaction Updates

The application handles transaction updates by:
1. Receiving events via Socket.io
2. Updating the React state with new transactions
3. Rendering the updated list with status indicators

## Backend Implementation

### Socket.io Server

The standalone Socket.io server (`server.js`) handles:
1. Client connections
2. Wallet address registration
3. Fetching of historical transactions
4. Real-time transaction streaming
5. Transaction status updates

### Real-Time Transaction Monitoring

We've implemented dual approaches to ensure real-time updates:

1. **WebSocket Subscription**: Direct subscription to Ethereum network via Infura
2. **Etherscan Polling**: Regular polling of Etherscan API as a fallback/supplement

#### Etherscan Polling Implementation

```javascript
// Excerpt from server.js
async function pollEtherscanForNewTransactions(address, socketId) {
  try {
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
        
        // Find and notify the client
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit(SOCKET_EVENTS.NEW_TRANSACTION, tx);
        }
      }
    }
    
    return transactions;
  } catch (error) {
    console.error(`Error polling Etherscan for ${address}:`, error);
    return [];
  }
}

// Start polling for a specific client
function startEtherscanPolling(address, socketId) {
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
```

### Transaction Formatting

Transactions are formatted consistently to ensure compatibility between different data sources:

```javascript
// Excerpt from server.js
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
```

## WebSocket Communication

### Socket Events

The application uses the following Socket.io events:

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | Client → Server | Socket connection established |
| `disconnect` | Client → Server | Socket disconnected |
| `wallet-connect` | Client → Server | Register wallet address for monitoring |
| `wallet-disconnect` | Client → Server | Unregister wallet address |
| `transaction-history` | Server → Client | Initial transaction history |
| `new-transaction` | Server → Client | Real-time transaction update |
| `connection-error` | Server → Client | Error notification |

### Example: Listening for New Transactions

```javascript
// Client-side code
socket.on('new-transaction', (transaction) => {
  console.log(`New transaction received: ${transaction.hash}`);
  // Update UI with the new transaction
  setTransactions(prev => [transaction, ...prev]);
});
```

## Database Schema

The application uses Supabase as a backend database with the following schema:

### Tags Table

```sql
create table tags (
  wallet_address text not null,
  target_address text not null,
  tag_name text not null,
  created_at timestamp with time zone default now()
);

-- Recommended indexes for better query performance
create index idx_tags_wallet_address on tags(wallet_address);
create index idx_tags_target_address on tags(target_address);
```

This table stores address tags created by users:
- `wallet_address`: The Ethereum address of the wallet that created the tag
- `target_address`: The Ethereum address being tagged/labeled
- `tag_name`: The custom label assigned to the address
- `created_at`: Timestamp when the tag was created

### Optional Transactions Table

If you choose to implement transaction caching in the database, you can use this schema:

```sql
create table transactions (
  id text primary key,
  hash text not null,
  from text not null,
  to text,
  value text not null,
  timestamp bigint not null,
  blockNumber bigint,
  gas text,
  gasPrice text,
  nonce integer,
  status text,
  created_at timestamp with time zone default now()
);

-- Create indexes for better query performance
create index idx_transactions_from on transactions(from);
create index idx_transactions_to on transactions(to);
create index idx_transactions_timestamp on transactions(timestamp);
```

## API Reference

### REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transactions?address={address}` | GET | Get transaction history for an address |
| `/api/tags` | GET | Get all address tags |
| `/api/tags` | POST | Create a new address tag with parameters: `wallet_address`, `target_address`, and `tag_name` |
| `/api/debug/tags` | GET | Debug endpoint for tag testing |

When creating a new tag, the API expects a JSON body in this format:
```json
{
  "wallet_address": "0x7ff635039a391dd518db326aab531b35e",  // The wallet creating the tag
  "target_address": "0xaae3cba71bc70abe1e12b79b98d6e2f189",  // The address being tagged
  "tag_name": "Exchange"  // Custom label for the address
}
```

The response will include the created tag with a timestamp:
```json
{
  "success": true,
  "tag": {
    "wallet_address": "0x7ff635039a391dd518db326aab531b35e",
    "target_address": "0xaae3cba71bc70abe1e12b79b98d6e2f189",
    "tag_name": "Exchange",
    "created_at": "2023-03-31T18:55:23.178+00"
  }
}
```

### WebSocket Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/socket` | Socket.io WebSocket endpoint |

## Troubleshooting

### Common Issues

#### No Transactions Appearing

1. Verify wallet address is correct
2. Check API keys in environment variables
3. Ensure socket server is running
4. Check browser console for connection errors
5. Verify Etherscan API rate limits haven't been exceeded

#### Socket Connection Issues

1. Make sure server is running on correct port
2. Check CORS configuration
3. Ensure client is connecting to correct URL
4. Verify network connectivity

## Deployment Guide

### Vercel Deployment (Next.js)

1. Push your code to a Git repository
2. Connect the repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy the application

### Socket Server Deployment

The Socket.io server should be deployed separately:

1. Set up a Node.js host (e.g., Heroku, DigitalOcean)
2. Configure environment variables
3. Start the server with PM2 or similar process manager:
   ```bash
   pm2 start server.js --name "wallet-transaction-socket-server"
   ```

4. Update the client configuration to point to the deployed socket server

### Environment Variables for Production

Ensure the following environment variables are set in production:

```
ETHERSCAN_API_KEY=your_etherscan_key
INFURA_API_KEY=your_infura_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=your_app_url
```

## Maintenance and Monitoring

### Logging

The application uses console logging extensively. In production, consider:
- Implementing a proper logging service (e.g., Winston)
- Setting up log aggregation (e.g., Loggly, Papertrail)
- Monitoring error rates

### Performance Monitoring

- Monitor WebSocket connection health
- Track Etherscan API usage to avoid rate limits
- Monitor memory usage of the Socket.io server

## License

This project is licensed under the MIT License - see the LICENSE file for details. 