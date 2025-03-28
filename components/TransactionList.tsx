'use client'

import { useState } from 'react'
import { Transaction, AddressTag } from '@/types'
import React from 'react'

interface TransactionListProps {
  transactions: Transaction[]
  isLoading: boolean
  tags: AddressTag[]
}

export default function TransactionList({ transactions, isLoading, tags }: TransactionListProps) {
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  
  // Helper function to get tag by address
  const getTagForAddress = (address: string): string | null => {
    const tag = tags.find(t => t.address.toLowerCase() === address.toLowerCase())
    return tag ? tag.tag : null
  }
  
  // Format address with tag if it exists
  const formatAddress = (address: string): React.ReactNode => {
    const tag = getTagForAddress(address)
    
    return (
      <span className="font-mono">
        {tag ? (
          <span className="inline-flex items-center">
            <span className="bg-gradient-to-r from-purple-800 to-indigo-900 text-purple-100 px-2 py-0.5 rounded-md mr-2 border border-purple-700/30 text-xs">
              {tag}
            </span>
            {`${address.slice(0, 6)}...${address.slice(-4)}`}
          </span>
        ) : (
          `${address.slice(0, 6)}...${address.slice(-4)}`
        )}
      </span>
    )
  }
  
  // Format ETH value
  const formatValue = (value: string): string => {
    const ethValue = parseFloat(value) / 1e18
    return ethValue.toFixed(6) + ' ETH'
  }
  
  return (
    <div className="w-full mt-6 mb-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold flex items-center relative">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mr-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
           </svg>
          </div>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-white">Transaction History</span>
        </h2>
        
        <div className="text-sm text-purple-200">
          <span className="px-3 py-1 rounded-full bg-[#1D0F45] border border-purple-700/30">{transactions.length} transactions</span>
        </div>
      </div>
      
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="bg-[#160c33]/80 h-24 rounded-xl border border-purple-800/30"></div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-[#160c33]/80 rounded-xl shadow-[0_8px_30px_rgba(90,50,180,0.15)] p-8 text-center border border-purple-800/50 backdrop-blur-sm">
          <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-gradient-to-br from-purple-800/40 to-indigo-900/40 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
          </div>
          <p className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-purple-100 to-white">No transactions found for this wallet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div 
              key={tx.id} 
              className="bg-[#160c33]/80 rounded-xl shadow-[0_4px_20px_rgba(90,50,180,0.1)] p-5 border border-purple-800/50 backdrop-blur-sm transition-all duration-300 hover:shadow-[0_4px_25px_rgba(120,80,220,0.18)] relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center mb-3">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      tx.status === 'success' ? 'bg-green-500' : 
                      tx.status === 'pending' ? 'bg-yellow-500' : 
                      'bg-red-500'
                    }`}></div>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                      tx.status === 'success' ? 'bg-green-900/60 text-green-200 border-green-700/50' : 
                      tx.status === 'pending' ? 'bg-yellow-900/60 text-yellow-200 border-yellow-700/50' : 
                      'bg-red-900/60 text-red-200 border-red-700/50'
                    }`}>
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </span>
                    <span className="ml-auto text-xs text-purple-200">
                      {new Date(tx.timestamp * 1000).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="mb-2 bg-[#1D0F45] rounded-lg p-3 border border-purple-700/30">
                    <div className="flex items-center mb-2">
                      <span className="text-xs font-medium text-purple-200 w-16">From:</span>
                      {formatAddress(tx.from)}
                    </div>
                    <div className="flex items-center">
                      <span className="text-xs font-medium text-purple-200 w-16">To:</span>
                      {formatAddress(tx.to)}
                    </div>
                  </div>
                </div>
                
                <div className="shrink-0 text-right">
                  <div className="text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-indigo-400">{formatValue(tx.value)}</div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button 
                  onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                  className="text-purple-300 text-sm font-medium hover:text-purple-200 flex items-center transition-colors mt-2"
                >
                  {expandedTx === tx.id ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                      Hide Details
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      View Details
                    </>
                  )}
                </button>
              </div>
              
              {expandedTx === tx.id && (
                <div className="mt-4 pt-4 border-t border-purple-700/40">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#1D0F45] p-3 rounded-lg border border-purple-700/30">
                      <h4 className="text-xs font-semibold uppercase text-purple-300 mb-2">Transaction Hash</h4>
                      <p className="font-mono text-xs break-all">{tx.hash}</p>
                    </div>
                    <div className="bg-[#1D0F45] p-3 rounded-lg border border-purple-700/30">
                      <h4 className="text-xs font-semibold uppercase text-purple-300 mb-2">Block</h4>
                      <p className="font-mono">{tx.blockNumber}</p>
                    </div>
                    <div className="bg-[#1D0F45] p-3 rounded-lg border border-purple-700/30">
                      <h4 className="text-xs font-semibold uppercase text-purple-300 mb-2">Gas</h4>
                      <div className="flex justify-between">
                        <p>Amount: {tx.gas}</p>
                        <p>Price: {parseInt(tx.gasPrice) / 1e9} Gwei</p>
                      </div>
                    </div>
                    <div className="bg-[#1D0F45] p-3 rounded-lg border border-purple-700/30">
                      <h4 className="text-xs font-semibold uppercase text-purple-300 mb-2">Nonce</h4>
                      <p className="font-mono">{tx.nonce}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 