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
  status: string;
}

export interface AddressTag {
  id: string;
  address: string;
  tag: string;
  createdBy: string;
  createdAt: number;
} 