import { NextRequest, NextResponse } from 'next/server'
import { Transaction } from '@/types'
import { getAddressTransactions } from '@/utils/blockchain'

// Fallback to mock data if real data fetching fails
import { ethers } from 'ethers'
import crypto from 'crypto'

// Cache transactions to reduce API calls during development
const transactionCache = new Map<string, { transactions: Transaction[], timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')?.toLowerCase()
  
  if (!address) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
  }
  
  try {
    // Check cache first
    const cacheEntry = transactionCache.get(address);
    const now = Date.now();
    
    if (cacheEntry && (now - cacheEntry.timestamp < CACHE_DURATION)) {
      console.log(`Using cached transactions for ${address}`);
      return NextResponse.json(cacheEntry.transactions);
    }
    
    // Fetch real transaction data
    const transactions = await getAddressTransactions(address);
    
    // Cache the result
    transactionCache.set(address, { 
      transactions, 
      timestamp: now 
    });
    
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error fetching real transactions:', error);
    
    // Fallback to mock data if there's an error
    console.warn('Falling back to mock transaction data');
    const mockTransactions = generateMockTransactions(address);
    return NextResponse.json(mockTransactions);
  }
}

// Generate some mock transactions for demonstration (fallback only)
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