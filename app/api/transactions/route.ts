import { NextRequest, NextResponse } from 'next/server'
import { Transaction } from '@/types'
import { getAddressTransactions } from '@/utils/blockchain'

// Define the return type from getAddressTransactions
interface TransactionResult {
  transactions: Transaction[];
  error: string | null;
}

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
    
    // Fetch transaction data
    const result = await getAddressTransactions(address) as TransactionResult;
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    
    const transactions = result.transactions || [];
    
    // Cache the result
    transactionCache.set(address, { 
      transactions, 
      timestamp: now 
    });
    
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}

// Add POST method handler
export async function POST(request: NextRequest) {
  try {
    // Get transactions from request body
    const transactionsData = await request.json();
    
    // For single transaction
    if (!Array.isArray(transactionsData)) {
      console.log('Storing single transaction:', transactionsData.hash);
      
      // Here you would typically store the transaction in a database
      // Since we've simplified to not use a database, we'll just acknowledge receipt
      
      return NextResponse.json({ 
        success: true, 
        message: 'Transaction received',
        transaction: transactionsData
      });
    }
    
    // For multiple transactions
    console.log(`Storing ${transactionsData.length} transactions`);
    
    // Here you would typically store the transactions in a database
    // Since we've simplified to not use a database, we'll just acknowledge receipt
    
    return NextResponse.json({ 
      success: true, 
      message: 'Transactions received',
      count: transactionsData.length 
    });
  } catch (error) {
    console.error('Error storing transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to store transactions' },
      { status: 500 }
    );
  }
} 