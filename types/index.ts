export interface Transaction {
  id: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  blockNumber: number;
  gas: string;
  gasPrice: string;
  nonce: number;
  status: 'pending' | 'success' | 'failed';
  created_at?: string; // From Supabase
}

export interface AddressTag {
  id: string;
  address: string;
  tag: string;
  created_by: string;
  signature: string;
  created_at?: string; // From Supabase
}

export interface SocketEvents {
  CONNECT: string;
  DISCONNECT: string;
  CONNECT_ERROR: string;
  WALLET_CONNECT: string;
  WALLET_DISCONNECT: string;
  TRANSACTION_HISTORY: string;
  NEW_TRANSACTION: string;
  USING_MOCK_DATA: string;
  CONNECTION_ERROR: string;
  TRANSPORT_CHANGE: string;
} 