import { NextRequest, NextResponse } from 'next/server'
import { Transaction } from '@/types'
import { ethers } from 'ethers'
import crypto from 'crypto'

// Simulated database for transactions 
// In a real app, this would be a database connection
let mockTransactions: Transaction[] = []

// Generate some mock transactions for demonstration
function generateMockTransactions(address: string): Transaction[] {
  // Return empty if no address
  if (!address) return []
  
  const transactions: Transaction[] = []
  const now = Math.floor(Date.now() / 1000)
  
  // Some example addresses for variety
  const addresses = [
    '0x1234567890123456789012345678901234567890',
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    '0x9876543210987654321098765432109876543210',
    '0xfedcbafedcbafedcbafedcbafedcbafedcbafedc',
    address,
  ]
  
  // Create 15 mock transactions
  for (let i = 0; i < 15; i++) {
    const isSender = Math.random() > 0.5
    const otherParty = addresses[Math.floor(Math.random() * (addresses.length - 1))]
    
    transactions.push({
      id: `tx-${i}-${Date.now()}`,
      hash: `0x${crypto.randomBytes(32).toString('hex')}`,
      from: isSender ? address.toLowerCase() : otherParty.toLowerCase(),
      to: isSender ? otherParty.toLowerCase() : address.toLowerCase(),
      value: ethers.utils.parseEther((Math.random() * 2).toFixed(6)).toString(),
      timestamp: now - i * 3600, // Each tx is 1 hour apart
      blockNumber: 10000000 + i,
      gas: ethers.utils.parseUnits('21000', 'wei').toString(),
      gasPrice: ethers.utils.parseUnits('20', 'gwei').toString(),
      nonce: i,
      status: Math.random() > 0.2 ? 'success' : (Math.random() > 0.5 ? 'pending' : 'failed')
    })
  }
  
  return transactions
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')?.toLowerCase()
  
  if (!address) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
  }
  
  // In a real app, fetch transactions from a blockchain API
  // For demonstration, we'll generate mock data
  if (mockTransactions.length === 0) {
    mockTransactions = generateMockTransactions(address)
  }
  
  // Filter transactions for this address
  const addressTransactions = mockTransactions.filter(
    tx => tx.from === address || tx.to === address
  )
  
  // Sort by timestamp (newest first)
  addressTransactions.sort((a, b) => b.timestamp - a.timestamp)
  
  return NextResponse.json(addressTransactions)
} 