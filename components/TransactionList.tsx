'use client'

import { useState } from 'react'
import { Transaction, AddressTag } from '@/types'
import React from 'react'
import { useAccount, useSignMessage } from 'wagmi'

interface TransactionListProps {
  transactions: Transaction[]
  isLoading: boolean
  tags: AddressTag[]
  setTags: React.Dispatch<React.SetStateAction<AddressTag[]>>
}

export default function TransactionList({ transactions, isLoading, tags, setTags }: TransactionListProps) {
  const { address: walletAddress } = useAccount()
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  
  // Tagging state
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [addressToTag, setAddressToTag] = useState('')
  const [tagName, setTagName] = useState('')
  const [tagError, setTagError] = useState<string | null>(null)
  const [isSubmittingTag, setIsSubmittingTag] = useState(false)
  
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
            <span className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-2.5 py-0.5 rounded-md mr-2 border border-purple-500/30 text-xs flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
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
  
  // Validate Ethereum address
  const isValidAddress = (addr: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr)
  }
  
  // Helper function to calculate transaction age
  const getTransactionAge = (timestamp: number): string => {
    const now = Math.floor(Date.now() / 1000)
    const diff = now - timestamp
    
    // Convert to days
    const days = diff / 86400 // 86400 seconds in a day
    
    if (days < 1) {
      // For transactions less than a day old, show with 2 decimal places
      return `${days.toFixed(2)} days ago`
    } else if (days < 10) {
      // For transactions between 1-10 days, show with 1 decimal place
      return `${days.toFixed(1)} days ago`
    } else {
      // For older transactions, show as whole days
      return `${Math.floor(days)} days ago`
    }
  }
  
  // Create a new tag with signature
  const createTag = async (signature: string) => {
    if (!walletAddress || !isValidAddress(addressToTag) || !tagName.trim()) {
      setTagError('Please provide a valid tag name')
      setIsSubmittingTag(false)
      return
    }
    
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: addressToTag,
          tag: tagName,
          createdBy: walletAddress,
          signature
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create tag')
      }
      
      const newTag = await response.json()
      
      // Format the new tag to match our expected format
      const formattedTag: AddressTag = {
        id: newTag.id,
        address: newTag.address,
        tag: newTag.tag,
        created_by: newTag.created_by,
        signature: newTag.signature,
        created_at: newTag.created_at
      }
      
      setTags([...tags, formattedTag])
      
      // Reset form
      closeTagModal()
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsSubmittingTag(false)
    }
  }
  
  // Signature hook
  const { signMessage } = useSignMessage({
    mutation: {
      onSuccess: async (data) => {
        await createTag(data)
      },
    }
  })
  
  // Handle tag submission
  const handleTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingTag(true)
    setTagError(null)
    
    if (!walletAddress || !isValidAddress(addressToTag) || !tagName.trim()) {
      setTagError('Please provide a valid tag name')
      setIsSubmittingTag(false)
      return
    }
    
    // Create message to sign
    const message = `I want to create a tag "${tagName}" for address ${addressToTag}`
    
    // Request signature from wallet
    signMessage({ message })
  }
  
  // Open tag modal for a specific address
  const openTagModal = (address: string) => {
    setAddressToTag(address)
    setTagName('')
    setTagError(null)
    setTagModalOpen(true)
  }
  
  // Close tag modal
  const closeTagModal = () => {
    setTagModalOpen(false)
    setAddressToTag('')
    setTagName('')
    setTagError(null)
    setIsSubmittingTag(false)
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
      ) :
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div 
              key={tx.id} 
              className="bg-[#160c33]/80 rounded-xl shadow-[0_4px_20px_rgba(90,50,180,0.1)] p-5 border border-purple-800/50 backdrop-blur-sm transition-all duration-300 hover:shadow-[0_4px_25px_rgba(120,80,220,0.18)] relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10"></div>
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 relative z-10">
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
                      {walletAddress && !getTagForAddress(tx.from) && tx.from.toLowerCase() !== walletAddress.toLowerCase() && (
                        <button 
                          onClick={() => openTagModal(tx.from)}
                          className="ml-2 text-xs text-white hover:text-white px-2 py-1 rounded-full bg-purple-600/60 hover:bg-purple-500/70 transition-colors flex items-center"
                          title="Add a tag for this address"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          Tag
                        </button>
                      )}
                    </div>
                    <div className="flex items-center">
                      <span className="text-xs font-medium text-purple-200 w-16">To:</span>
                      {formatAddress(tx.to)}
                      {walletAddress && !getTagForAddress(tx.to) && tx.to.toLowerCase() !== walletAddress.toLowerCase() && (
                        <button 
                          onClick={() => openTagModal(tx.to)}
                          className="ml-2 text-xs text-white hover:text-white px-2 py-1 rounded-full bg-purple-600/60 hover:bg-purple-500/70 transition-colors flex items-center"
                          title="Add a tag for this address"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          Tag
                        </button>
                      )}
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
                  className="px-3 py-1.5 text-sm rounded-md bg-purple-700/40 hover:bg-purple-600/50 text-white font-medium flex items-center transition-all duration-200 relative z-10 border border-purple-500/30"
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
                      <h4 className="text-xs font-semibold uppercase text-purple-300 mb-2">Transaction Fee</h4>
                      <p className="font-mono">
                        {(parseInt(tx.gas) * parseInt(tx.gasPrice) / 1e18).toFixed(8)} ETH
                      </p>
                    </div>
                    <div className="bg-[#1D0F45] p-3 rounded-lg border border-purple-700/30">
                      <h4 className="text-xs font-semibold uppercase text-purple-300 mb-2">Age</h4>
                      <div className="flex justify-between">
                        <p>{getTransactionAge(tx.timestamp)}</p>
                        <p className="text-xs text-purple-300">{new Date(tx.timestamp * 1000).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex mt-4 gap-2">
                    {!getTagForAddress(tx.from) && tx.from.toLowerCase() !== walletAddress?.toLowerCase() && (
                      <button
                        onClick={() => openTagModal(tx.from)}
                        className="px-3 py-1.5 text-sm rounded-md bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-medium transition-all duration-200 flex items-center shadow-[0_2px_10px_rgba(90,50,180,0.2)]"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        Tag Sender
                      </button>
                    )}
                    
                    {!getTagForAddress(tx.to) && tx.to.toLowerCase() !== walletAddress?.toLowerCase() && (
                      <button
                        onClick={() => openTagModal(tx.to)}
                        className="px-3 py-1.5 text-sm rounded-md bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-medium transition-all duration-200 flex items-center shadow-[0_2px_10px_rgba(90,50,180,0.2)]"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        Tag Recipient
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      }
      
      {/* Tag Modal */}
      {tagModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm bg-[#0a051d]/70">
          <div className="bg-[#160c33] rounded-xl shadow-[0_8px_30px_rgba(90,50,180,0.3)] p-6 border border-purple-800/50 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-white">
                Add Address Tag
              </h3>
              <button
                onClick={closeTagModal}
                className="text-purple-300 hover:text-purple-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleTagSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-purple-300 mb-1">
                  Ethereum Address
                </label>
                <div className="bg-[#1D0F45] border border-purple-700/30 rounded-md px-3 py-2 font-mono text-sm break-all">
                  {addressToTag}
                </div>
              </div>
              
              <div className="mb-4">
                <label htmlFor="tagName" className="block text-sm font-medium text-purple-300 mb-1">
                  Tag Name
                </label>
                <input
                  type="text"
                  id="tagName"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="Exchange, Friend, etc."
                  className="w-full px-3 py-2 border border-purple-600/40 rounded-md bg-[#160c33]/90 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/70"
                  required
                />
              </div>
              
              {tagError && (
                <div className="mb-4 text-red-400 text-sm px-3 py-2 bg-red-900/20 border border-red-700/40 rounded-md">
                  {tagError}
                </div>
              )}
              
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={closeTagModal}
                  className="px-4 py-2 text-sm border border-purple-700/50 rounded-md hover:bg-purple-800/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTag}
                  className="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 shadow-[0_4px_15px_rgba(90,50,180,0.2)] hover:shadow-[0_4px_20px_rgba(120,80,220,0.35)] disabled:opacity-50 disabled:hover:shadow-none"
                >
                  {isSubmittingTag ? 'Submitting...' : 'Create Tag'}
                </button>
              </div>
              <p className="mt-3 text-xs text-center text-purple-300/70">
                This will require a signature from your wallet (no gas fees)
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  )
} 