import { NextResponse } from 'next/server';
import supabase from '@/utils/supabase';

// GET transactions for a wallet address
export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  
  if (!address) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    );
  }
  
  try {
    // Normalize address to lowercase
    const normalizedAddress = address.toLowerCase();
    
    // Query transactions where the address is either sender or receiver
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .or(`from.eq.${normalizedAddress},to.eq.${normalizedAddress}`)
      .order('timestamp', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

// POST a new transaction or batch of transactions
export async function POST(request) {
  try {
    const body = await request.json();
    
    // Handle both single transaction and array of transactions
    const transactions = Array.isArray(body) ? body : [body];
    
    if (transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions provided' },
        { status: 400 }
      );
    }
    
    // Prepare transactions for insertion
    const preparedTransactions = transactions.map(tx => ({
      id: tx.hash, // Use hash as the primary ID
      hash: tx.hash,
      from: tx.from.toLowerCase(),
      to: tx.to ? tx.to.toLowerCase() : null,
      value: tx.value,
      timestamp: tx.timestamp,
      blockNumber: tx.blockNumber,
      gas: tx.gas,
      gasPrice: tx.gasPrice,
      nonce: tx.nonce,
      status: tx.status,
    }));
    
    // Use upsert to avoid duplicates (insert if not exists, update if exists)
    const { data, error } = await supabase
      .from('transactions')
      .upsert(preparedTransactions, { onConflict: 'id' });
    
    if (error) throw error;
    
    return NextResponse.json({ 
      success: true, 
      message: `${preparedTransactions.length} transaction(s) saved` 
    });
  } catch (error) {
    console.error('Error saving transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save transactions' },
      { status: 500 }
    );
  }
} 