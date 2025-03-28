'use client'

import { useEffect, useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import TransactionList from '@/components/TransactionList'
import WalletConnect from '@/components/WalletConnect'
import AddressTagging from '@/components/AddressTagging'
import { Transaction, AddressTag } from '@/types'

export default function Home() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [tags, setTags] = useState<AddressTag[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  // Fetch transaction history when wallet is connected
  useEffect(() => {
    if (isConnected && address) {
      fetchTransactionHistory()
      setupWebSocketConnection()
      fetchTags()
    }
    
    return () => {
      // Clean up WebSocket connection when component unmounts
      if (window.transactionSocket) {
        window.transactionSocket.close()
      }
    }
  }, [isConnected, address])
  
  const fetchTransactionHistory = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/transactions?address=${address}`)
      const data = await response.json()
      setTransactions(data)
    } catch (error) {
      console.error('Failed to fetch transaction history:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const setupWebSocketConnection = () => {
    // Create WebSocket connection for real-time transaction streaming
    const socket = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/transactions?address=${address}`)
    
    socket.onopen = () => {
      console.log('WebSocket connection established')
    }
    
    socket.onmessage = (event) => {
      const newTransaction = JSON.parse(event.data)
      setTransactions(prev => [newTransaction, ...prev])
    }
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    // Store the socket instance for cleanup
    window.transactionSocket = socket
  }
  
  const fetchTags = async () => {
    try {
      const response = await fetch(`/api/tags?address=${address}`)
      const data = await response.json()
      setTags(data)
    } catch (error) {
      console.error('Failed to fetch address tags:', error)
    }
  }
  
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
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  </div>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-white">Network</span>
                </h2>
                <div className="flex items-center p-3 bg-[#1D0F45] rounded-lg border border-purple-700/30">
                  <div className="relative">
                    <div className="h-3 w-3 rounded-full bg-green-500 mr-3"></div>
                    <div className="absolute inset-0 h-3 w-3 rounded-full bg-green-400 animate-ping opacity-50"></div>
                  </div>
                  <p className="font-medium">Ethereum Mainnet</p>
                </div>
              </div>
            </div>
            
            <AddressTagging tags={tags} setTags={setTags} />
            
            <TransactionList 
              transactions={transactions} 
              isLoading={isLoading} 
              tags={tags}
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

// Add TypeScript augmentation for the Window interface
declare global {
  interface Window {
    transactionSocket?: WebSocket
  }
}
