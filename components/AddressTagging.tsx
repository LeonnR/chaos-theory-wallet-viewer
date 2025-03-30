'use client'

import React, { useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { AddressTag } from '@/types'

interface AddressTaggingProps {
  tags: AddressTag[]
  setTags: React.Dispatch<React.SetStateAction<AddressTag[]>>
}

export default function AddressTagging({ tags, setTags }: AddressTaggingProps) {
  const { address } = useAccount()
  const [isOpen, setIsOpen] = useState(false)
  const [address2Tag, setAddress2Tag] = useState('')
  const [tagName, setTagName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const createTag = async (signature: string) => {
    if (!address || !isValidAddress(address2Tag) || !tagName.trim()) {
      setError('Please provide a valid address and tag name')
      setIsSubmitting(false)
      return
    }
    
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: address2Tag,
          tag: tagName,
          createdBy: address,
          signature
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to create tag')
      }
      
      const newTag = await response.json()
      setTags([...tags, newTag])
      
      // Reset form
      setAddress2Tag('')
      setTagName('')
      setIsOpen(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const { signMessage } = useSignMessage({
    mutation: {
      onSuccess: async (data) => {
        await createTag(data)
      },
    }
  })
  
  // Validate Ethereum address
  const isValidAddress = (addr: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr)
  }
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    
    if (!address || !isValidAddress(address2Tag) || !tagName.trim()) {
      setError('Please provide a valid address and tag name')
      setIsSubmitting(false)
      return
    }
    
    // Create message to sign
    const message = `I want to create a tag "${tagName}" for address ${address2Tag}`
    
    // Request signature from wallet
    signMessage({ message })
  }
  
  // Delete a tag
  const deleteTag = async (tagId: string) => {
    try {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: address
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete tag')
      }
      
      setTags(tags.filter(tag => tag.id !== tagId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    }
  }
  
  return (
    <div className="w-full max-w-4xl mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-white">Address Tags</span>
        </h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-medium py-1.5 px-4 rounded-lg transition-all duration-300 shadow-[0_2px_10px_rgba(90,50,180,0.15)] hover:shadow-[0_2px_15px_rgba(120,80,220,0.25)] text-sm relative group overflow-hidden"
        >
          <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-600/10 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></span>
          <span className="relative z-10">
            {isOpen ? 'Cancel' : 'Add New Tag'}
          </span>
        </button>
      </div>
      
      {isOpen && (
        <div className="bg-[#1D0F45]/90 p-5 rounded-lg mb-4 border border-purple-700/40 shadow-[0_4px_20px_rgba(90,50,180,0.15)]">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-purple-300 mb-1">
                  Ethereum Address
                </label>
                <input
                  type="text"
                  id="address"
                  value={address2Tag}
                  onChange={(e) => setAddress2Tag(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-purple-600/40 rounded-md bg-[#160c33]/90 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/70"
                  required
                />
              </div>
              <div>
                <label htmlFor="tag" className="block text-sm font-medium text-purple-300 mb-1">
                  Tag Name
                </label>
                <input
                  type="text"
                  id="tag"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="Exchange, Friend, etc."
                  className="w-full px-3 py-2 border border-purple-600/40 rounded-md bg-[#160c33]/90 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/70"
                  required
                />
              </div>
            </div>
            
            {error && (
              <div className="mt-3 text-red-400 text-sm px-3 py-2 bg-red-900/20 border border-red-700/40 rounded-md">{error}</div>
            )}
            
            <div className="mt-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-medium py-2 px-6 rounded-lg transition-all duration-300 shadow-[0_4px_15px_rgba(90,50,180,0.2)] hover:shadow-[0_4px_20px_rgba(120,80,220,0.35)] disabled:opacity-50 disabled:hover:shadow-none relative overflow-hidden group"
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-600/10 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                <span className="relative z-10">
                  {isSubmitting ? 'Submitting...' : 'Create Tag'}
                </span>
              </button>
              <p className="mt-1 text-xs text-purple-300/70">
                This will require a signature from your wallet (no gas fees)
              </p>
            </div>
          </form>
        </div>
      )}
      
      {tags.length > 0 ? (
        <div className="bg-[#160c33]/80 rounded-xl shadow-[0_8px_30px_rgba(90,50,180,0.15)] border border-purple-800/50 backdrop-blur-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-purple-700/40">
              <thead className="bg-[#1D0F45]/90">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                    Address
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                    Tag
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-purple-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-700/40">
                {tags.map((tag) => (
                  <tr key={tag.id} className="bg-transparent hover:bg-purple-800/10 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-white">
                      {tag.address.slice(0, 6)}...{tag.address.slice(-4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-800 to-indigo-900 text-purple-100 border border-purple-700/30">
                        {tag.tag}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => deleteTag(tag.id)}
                        className="text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-900/20"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 bg-[#160c33]/80 rounded-xl shadow-[0_8px_30px_rgba(90,50,180,0.15)] border border-purple-800/50 backdrop-blur-sm">
          <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-gradient-to-br from-purple-800/30 to-indigo-900/30 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-300/60" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-white text-lg">No tags created yet.</p>
        </div>
      )}
    </div>
  )
} 