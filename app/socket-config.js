// Socket.io Configuration
export const socketConfig = {
  path: '/api/socket',
  transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
  autoConnect: true,
  withCredentials: true,
  upgrade: true,
  rememberUpgrade: true
};

// Socket Events
export const SOCKET_EVENTS = {
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
  CONNECTION_ERROR: 'connection-error',
  
  // Transport events
  TRANSPORT_CHANGE: 'transport-change'
}; 