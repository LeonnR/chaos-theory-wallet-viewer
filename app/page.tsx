'use client'

import { useEffect, useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import TransactionList from '@/components/TransactionList'
import WalletConnect from '@/components/WalletConnect'
import { Transaction, AddressTag } from '@/types'
import { io } from 'socket.io-client'
import { SOCKET_EVENTS, socketConfig } from '@/app/socket-config'
import React from 'react'

export default function Home() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [tags, setTags] = useState<AddressTag[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isTagsLoading, setIsTagsLoading] = useState(false)
  const [socket, setSocket] = useState<any>(null)
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected')
  const [error, setError] = useState<string | null>(null)
  
  // Add a ref to track if we've already tried to fetch tags to prevent infinite loops
  const hasAttemptedTagsFetch = React.useRef(false)
  
  // Add a debounce function for the refresh button
  const debounce = (fn: Function, ms = 1000) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function(this: any, ...args: any[]) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
  };
  
  // Function to fetch address tags from the API
  const fetchTags = async (forceRefresh = false) => {
    if (tags.length > 0 && !forceRefresh) {
      console.log('Using cached tags:', tags.length);
      return tags;
    }
    
    try {
      setIsTagsLoading(true);
      
      // Use the current URL with port to avoid CORS issues
      const baseUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;
      
      // IMPORTANT CHANGE: Use the debug/tags endpoint which correctly returns tags
      // from the database instead of the regular endpoint which returns an empty array
      const apiUrl = `${baseUrl}/api/debug/tags`;
      
      console.log(`Fetching tags from URL: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.status}`);
      }
      
      const responseData = await response.json();
      
      // The debug endpoint returns a different structure, extract the formatted tags
      let fetchedTags = [];
      if (responseData.formatted_tags && Array.isArray(responseData.formatted_tags.items)) {
        console.log(`Found ${responseData.formatted_tags.items.length} tags using debug endpoint`);
        fetchedTags = responseData.formatted_tags.items;
      } else if (Array.isArray(responseData)) {
        // Handle regular endpoint response format for backward compatibility
        console.log(`Found ${responseData.length} tags using regular endpoint`);
        fetchedTags = responseData;
      } else {
        console.warn('Unexpected tags response format:', responseData);
        fetchedTags = [];
      }
      
      console.log('Fetched tags:', fetchedTags.length);
      setTags(fetchedTags);
      setIsTagsLoading(false);
      
      // Expose for debug purposes
      if (typeof window !== 'undefined') {
        window.getTagsState = () => [...tags];
      }
      
      return fetchedTags;
    } catch (error) {
      console.error('Error fetching tags:', error);
      setIsTagsLoading(false);
      return [];
    }
  };
  
  // Create a debounced version of fetchTags
  const debouncedFetchTags = React.useCallback(
    debounce(() => {
      console.log('Debounced fetchTags called');
      fetchTags();
    }, 1000),
    [fetchTags]  // Include fetchTags in the dependency array
  );
  
  // Initialize Socket.io connection
  useEffect(() => {
    // Socket should only be initialized once
    if (!socket) {
      try {
        // Use the current location with path /api/socket
        const socketUrl = window.location.hostname === 'localhost' 
          ? `http://${window.location.hostname}:3000`  // Connect to our standalone server
          : window.location.origin;  // Production: use the same origin

        console.log('Initializing socket connection to:', socketUrl);
        
        // Create the socket instance with enhanced debugging
        const newSocket = io(socketUrl, {
          ...socketConfig
        });
        
        // Enhanced error handling
        newSocket.io.on('error', (error) => {
          console.error('Socket.io transport error:', error);
        });
        
        newSocket.io.on('reconnect_attempt', (attempt) => {
          console.log(`Socket reconnection attempt #${attempt}`);
        });
        
        // Log connection details
        console.log(`Socket connection established with ID: ${newSocket.id}`);
        
        // Setup socket event listeners for connection status
        newSocket.on(SOCKET_EVENTS.CONNECT, () => {
          console.log('Socket connected');
          setConnectionStatus('connected');
          setError(null);
        });
        
        newSocket.on(SOCKET_EVENTS.DISCONNECT, () => {
          console.log('Socket disconnected');
          setConnectionStatus('disconnected');
        });
        
        newSocket.on(SOCKET_EVENTS.CONNECT_ERROR, (err) => {
          console.error('Socket connection error:', err);
          setConnectionStatus('error');
          setError(`Connection error: ${err.message}`);
        });
        
        setSocket(newSocket);
        
        return () => {
          console.log('Cleaning up socket connection');
          newSocket.disconnect();
        };
      } catch (err) {
        console.error('Error initializing socket:', err);
        setError(`Failed to initialize socket: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, [socket]);
  
  // Handle wallet connection
  useEffect(() => {
    if (isConnected && address && socket) {
      setIsLoading(true);
      setIsTagsLoading(true);
      setError(null);
      
      try {
        // Connect the socket if not connected
        if (!socket.connected) {
          console.log('Socket not connected, connecting now...');
          socket.connect();
        }
        
        console.log('Connecting socket and sending wallet address:', address);
        
        // Remove previous listeners to avoid duplicates
        socket.off(SOCKET_EVENTS.TRANSACTION_HISTORY);
        socket.off(SOCKET_EVENTS.NEW_TRANSACTION);
        socket.off(SOCKET_EVENTS.CONNECTION_ERROR);
        
        // Send wallet address to server
        socket.emit(SOCKET_EVENTS.WALLET_CONNECT, address);
        
        // Listen for initial transaction history
        socket.on(SOCKET_EVENTS.TRANSACTION_HISTORY, async (data: Transaction[]) => {
          console.log(`Received ${data.length} transactions from server`);
          setTransactions(data);
          setIsLoading(false);
          
          // Store transactions in Supabase
          if (data.length > 0) {
            try {
              // Use the same URL as the socket connection to ensure we hit the right server
              const apiUrl = window.location.hostname === 'localhost' 
                ? `http://${window.location.hostname}:3000/api/transactions`  // Use socket server port
                : '/api/transactions';  // Production: use relative path
              
              await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              console.log('Transactions stored in database');
            } catch (dbError) {
              console.error('Failed to store transactions in database:', dbError);
            }
          }
        });
        
        // Listen for new transactions
        socket.on(SOCKET_EVENTS.NEW_TRANSACTION, async (newTransaction: Transaction) => {
          console.log('Received new transaction:', newTransaction.hash);
          setTransactions(prev => [newTransaction, ...prev]);
          
          // Store new transaction in Supabase
          try {
            // Use the same URL as the socket connection to ensure we hit the right server
            const apiUrl = window.location.hostname === 'localhost' 
              ? `http://${window.location.hostname}:3000/api/transactions`  // Use socket server port
              : '/api/transactions';  // Production: use relative path
            
            await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newTransaction)
            });
            console.log('New transaction stored in database');
          } catch (dbError) {
            console.error('Failed to store new transaction in database:', dbError);
          }
        });
        
        // Handle connection errors
        socket.on(SOCKET_EVENTS.CONNECTION_ERROR, (data: {message: string}) => {
          console.error('Connection error from server:', data.message);
          setError(`Connection error: ${data.message}`);
        });
        
        // Add a reconnect handler
        socket.io.on("reconnect", () => {
          console.log('Socket reconnected, resending wallet address');
          socket.emit(SOCKET_EVENTS.WALLET_CONNECT, address);
        });
        
        // Fetch tags first, then transactions to ensure correct order
        fetchTags().then(() => {
          fetchStoredTransactions();
        }).catch(err => {
          console.error('Error in tag/transaction loading sequence:', err);
          // Still try to fetch transactions even if tags fail
          fetchStoredTransactions();
        });
      } catch (err) {
        console.error('Error in wallet connection effect:', err);
        setError(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
      
      return () => {
        // Clean up event listeners and disconnect
        console.log('Cleaning up socket event listeners');
        socket.off(SOCKET_EVENTS.TRANSACTION_HISTORY);
        socket.off(SOCKET_EVENTS.NEW_TRANSACTION);
        socket.off(SOCKET_EVENTS.CONNECTION_ERROR);
        socket.io.off("reconnect");
        socket.emit(SOCKET_EVENTS.WALLET_DISCONNECT);
      };
    }
    
  }, [isConnected, address, socket]);
  
  // Fetch transactions stored in Supabase
  const fetchStoredTransactions = async () => {
    if (!address) return;
    
    try {
      setIsLoading(true);
      console.log('Fetching stored transactions for address:', address);
      
      const response = await fetch(`/api/transactions?address=${address}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stored transactions');
      }
      
      const data = await response.json();
      console.log(`Fetched ${data.length} stored transactions from database`);
      
      if (data.length > 0) {
        // Only update state if we got transactions and no socket transactions yet
        if (transactions.length === 0) {
          setTransactions(data);
        }
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error fetching stored transactions:', error);
      // Don't set error state here as we might still get transactions from socket
    }
  }
  
  // Disconnect socket when wallet disconnects
  useEffect(() => {
    if (!isConnected && socket) {
      console.log('Wallet disconnected, notifying server');
      socket.emit(SOCKET_EVENTS.WALLET_DISCONNECT);
    }
  }, [isConnected, socket]);
  
  const testWebSocket = () => {
    console.log('Testing direct WebSocket connection...');
    
    // Create a direct WebSocket connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:3000/api/socket`;
    console.log('Connecting to WebSocket URL:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Direct WebSocket connection established successfully!');
      setError(null);
      // Close after successful test
      setTimeout(() => ws.close(), 1000);
    };
    
    ws.onerror = (err) => {
      console.error('Direct WebSocket error:', err);
      setError('Direct WebSocket connection failed. Check server logs.');
    };
    
    ws.onclose = () => {
      console.log('Direct WebSocket connection closed');
    };
  };
  
  // Fix the useEffect to avoid infinite loops
  useEffect(() => {
    // Only attempt to fetch tags once when connected
    if (isConnected && address && tags.length === 0 && !isTagsLoading && !hasAttemptedTagsFetch.current) {
      console.log('Connected with no tags, fetching tags (first attempt)...');
      hasAttemptedTagsFetch.current = true;
      fetchTags();
    }
  }, [isConnected, address, isTagsLoading, tags.length, fetchTags]); // Include fetchTags and tags.length
  
  // Add debug logging and expose function to window
  useEffect(() => {
    console.log('Setting up test functions on window object...');
    
    // Expose the fetch tags function
    window.testFetchTags = (force = false) => {
      console.log(`🔍 Manually calling fetchTags(${force})...`);
      return fetchTags(force)
        .then(() => {
          console.log('✅ fetchTags completed successfully');
          console.log(`📊 Current tags state (${tags.length} tags):`, tags);
          return tags;
        })
        .catch(err => {
          console.error('❌ fetchTags failed:', err);
          throw err;
        });
    };
    
    // Expose a function to check the current state
    window.getTagsState = () => {
      console.log(`📊 Current tags state (${tags.length} tags):`, tags);
      return tags;
    };
    
    window.checkTagsStatus = () => {
      console.log({
        tagsCount: tags.length,
        isTagsLoading,
        hasAttemptedFetch: hasAttemptedTagsFetch.current
      });
    };
    
    console.log('✅ Test functions added to window object. Try running:');
    console.log('   window.testFetchTags()');
    console.log('   window.getTagsState()');
    console.log('   window.checkTagsStatus()');
    
    return () => {
      console.log('Cleaning up test functions...');
      delete window.testFetchTags;
      delete window.getTagsState;
      delete window.checkTagsStatus;
    };
  }, [fetchTags, tags, isTagsLoading]);
  
  return (
    <div className="flex flex-col min-h-screen bg-[#0a051d] text-white relative" style={{ margin: 0, padding: 0, backgroundImage: 'radial-gradient(circle at 25% 10%, rgba(120, 40, 200, 0.15) 0%, transparent 45%)' }}>
      {/* Decorative element - glowing orb */}
      <div className="fixed top-24 left-32 w-64 h-64 rounded-full bg-purple-600/10 blur-3xl pointer-events-none"></div>
      {/* Decorative element - small glow */}
      <div className="fixed bottom-32 right-16 w-48 h-48 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none"></div>
      
      {/* Simple Header */}
      <header className="bg-[#12092b]/80 backdrop-blur-sm border-b border-purple-900/50 py-4 relative z-10">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold flex items-center">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-indigo-400 mr-2">Wallet</span> 
            <span className="relative">
              Transaction Viewer
              <span className="absolute -bottom-1 left-0 w-full h-[1px] bg-gradient-to-r from-purple-500 to-transparent"></span>
            </span>
          </h1>
        </div>
      </header>
      
      {/* Main content */}
      <main className="container mx-auto px-4 py-8 pb-24 flex-grow flex flex-col relative z-10">
        {!isConnected ? (
          <div className="flex items-center justify-center h-[calc(100vh-250px)]">
            <div className="max-w-lg w-full mx-auto bg-[#160c33]/80 rounded-xl shadow-[0_8px_30px_rgba(90,50,180,0.1)] p-8 text-center border border-purple-800/50 backdrop-blur-sm">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full mx-auto mb-6 flex items-center justify-center relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 blur-md opacity-50"></div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-white">Connect your wallet to view transaction history</h2>
              <p className="text-purple-200 mb-8">
                Track your transactions and monitor your wallet activity in real-time
              </p>
              <WalletConnect />
              <p className="text-sm text-purple-300/70 mt-6">
                Your data remains private and secure
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#160c33]/80 rounded-xl shadow-[0_8px_30px_rgba(90,50,180,0.15)] p-6 border border-purple-800/50 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <h2 className="text-xl font-semibold mb-4 flex items-center relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  </div>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-white">Connected Wallet</span>
                </h2>
                <div className="flex flex-col space-y-3">
                  <p className="font-mono text-sm bg-[#1D0F45] p-3 rounded-lg break-all border border-purple-700/30">{address}</p>
                  <button
                    onClick={() => disconnect()}
                    className="border border-purple-700/50 bg-gradient-to-r from-purple-800/80 to-purple-900/80 hover:from-purple-700/80 hover:to-purple-800/80 text-purple-200 hover:text-white font-medium py-2.5 px-4 mt-2 rounded-lg transition-all duration-200 flex items-center justify-center group relative z-10 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 mr-2 text-purple-300 group-hover:text-white transition-colors" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">Disconnect</span>
                    <span className="ml-1 text-xs text-purple-300 group-hover:text-purple-100 transition-colors">(0x{address?.slice(2, 6)})</span>
                  </button>
                </div>
              </div>
              
              <div className="bg-[#160c33]/80 rounded-xl shadow-[0_8px_30px_rgba(90,50,180,0.15)] p-6 border border-purple-800/50 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v-1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  </div>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-white">Network</span>
                </h2>
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center p-3 bg-[#1D0F45] rounded-lg border border-purple-700/30">
                    <div className="relative">
                      <div className="h-3 w-3 rounded-full bg-green-500 mr-3"></div>
                      <div className="absolute inset-0 h-3 w-3 rounded-full bg-green-400 animate-ping opacity-50"></div>
                    </div>
                    <p className="font-medium">Ethereum Mainnet</p>
                  </div>

                  <div className="flex items-center p-3 bg-[#1D0F45] rounded-lg border border-purple-700/30">
                    <div className="relative">
                      <div className={`h-3 w-3 rounded-full mr-3 ${
                        connectionStatus === 'connected' ? 'bg-green-500' : 
                        connectionStatus === 'disconnected' ? 'bg-yellow-500' : 
                        'bg-red-500'
                      }`}></div>
                      {connectionStatus === 'connected' && (
                        <div className="absolute inset-0 h-3 w-3 rounded-full bg-green-400 animate-ping opacity-50"></div>
                      )}
                    </div>
                    <p className="font-medium">Socket: {connectionStatus}</p>
                  </div>
                  
                  {error && (
                    <div className="p-3 bg-red-900/20 text-red-300 border border-red-700/30 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                  
                  <div className="p-2 bg-[#1D0F45] rounded-lg border border-purple-700/30 text-xs text-purple-300/80">
                    {transactions.length === 0 && !isLoading ? 
                      "No transactions found. This could be due to a new wallet, API limitations, or connectivity issues." : 
                      `Loaded ${transactions.length} transactions`
                    }
                  </div>
                  
                  {/* 
                  <button 
                    onClick={testWebSocket}
                    className="p-2 bg-purple-800/50 hover:bg-purple-700/50 text-white rounded-lg text-sm transition-colors"
                  >
                    Test WebSocket Connection
                  </button>
                  */}
                  
                  {/* <button 
                    onClick={() => debouncedFetchTags()}
                    className="p-2 bg-purple-800/50 hover:bg-purple-700/50 text-white rounded-lg text-sm transition-colors flex items-center justify-center disabled:opacity-50"
                    disabled={isTagsLoading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                    Refresh Tags {isTagsLoading && '(Loading...)'}
                  </button>
                  
                  <button 
                    onClick={() => {
                      console.clear();
                      console.log("Manual test initiated");
                      fetchTags(true);
                    }}
                    className="mt-2 p-2 bg-blue-700/50 hover:bg-blue-600/50 text-white rounded-lg text-sm"
                  >
                    Test API Call
                  </button> */}
                </div>
              </div>
            </div>
            
            <TransactionList 
              transactions={transactions} 
              isLoading={isLoading || isTagsLoading}
              tags={tags}
              setTags={setTags}
            />
          </>
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-[#12092b]/90 backdrop-blur-sm border-t border-purple-900/50 py-6 fixed bottom-0 left-0 right-0 w-full" style={{ marginBottom: 0 }}>
        <div className="container mx-auto px-4 text-center text-sm text-purple-300/80">
          <p>© {new Date().getFullYear()} Wallet Transaction Viewer by Leon Reuben <span className="text-purple-400/90">{'('}Chaos Theory Project{')'}</span></p>
        </div>
      </footer>
    </div>
  )
}

// Update your existing global Window interface augmentation
declare global {
  interface Window {
    transactionSocket?: WebSocket;
    testFetchTags?: (force?: boolean) => Promise<AddressTag[]>;
    getTagsState?: () => AddressTag[];
    checkTagsStatus?: () => void;
  }
}
