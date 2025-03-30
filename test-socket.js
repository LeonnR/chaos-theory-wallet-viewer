const { io } = require('socket.io-client');

// Create a socket client
const socket = io('http://localhost:3000', {
  path: '/api/socket',
  transports: ['polling', 'websocket']
});

// Handle connection events
socket.on('connect', () => {
  console.log('Connected to socket server');
  console.log('Socket ID:', socket.id);
  
  // Simulate connecting a wallet
  const testAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
  
  console.log(`Sending wallet-connect event with address: ${testAddress}`);
  socket.emit('wallet-connect', testAddress);
});

// Handle initial transaction data
socket.on('transaction-history', (transactions) => {
  console.log(`Received ${transactions.length} transactions:`);
  console.log(transactions[0]); // Log the first transaction
});

// Handle new transaction events
socket.on('new-transaction', (transaction) => {
  console.log('New transaction received:');
  console.log(transaction);
});

socket.on('disconnect', () => {
  console.log('Disconnected from socket server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

// Keep the script running for 30 seconds to test for new transactions
console.log('Listening for transactions for 30 seconds...');
setTimeout(() => {
  console.log('Test complete, disconnecting');
  socket.disconnect();
  process.exit(0);
}, 30000); 