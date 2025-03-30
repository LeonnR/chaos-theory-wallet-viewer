# Wallet Transaction Viewer

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### 1. Set up your API keys and database

This application uses Supabase for storing transaction data and address tags. You'll need to create a Supabase account and set up the appropriate tables.

```bash
# Set up the API keys and database configuration
pnpm create-env
# or
npm run create-env
```

Follow the prompts to enter your API keys for:
- Etherscan
- Infura
- Supabase URL
- Supabase Anon Key

You can get free API keys from:
- [Etherscan](https://etherscan.io/apis) - For transaction history
- [Infura](https://infura.io) - For WebSocket connections to Ethereum
- [Supabase](https://supabase.com) - For database storage

### 2. Set up Supabase Tables

After creating your Supabase project, you need to set up the following tables:

#### Transactions Table

```sql
create table transactions (
  id text primary key,
  hash text not null,
  from text not null,
  to text,
  value text not null,
  timestamp bigint not null,
  blockNumber bigint,
  gas text,
  gasPrice text,
  nonce integer,
  status text,
  created_at timestamp with time zone default now()
);

-- Create indexes for better query performance
create index idx_transactions_from on transactions(from);
create index idx_transactions_to on transactions(to);
create index idx_transactions_timestamp on transactions(timestamp);
```

#### Address Tags Table

```sql
create table address_tags (
  id text primary key,
  address text not null,
  tag text not null,
  created_by text not null,
  signature text not null,
  created_at timestamp with time zone default now()
);

-- Create indexes for better query performance
create index idx_address_tags_address on address_tags(address);
create index idx_address_tags_created_by on address_tags(created_by);
```

### 3. Start the socket server

For the best experience with WebSocket connections, run the custom Socket.io server:

```bash
# In one terminal window, start the socket server
pnpm socket-server
# or
npm run socket-server
```

### 4. Start the Next.js development server

Then, in a separate terminal window, run the Next.js development server:

```bash
pnpm dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Features

- Connect your wallet via WalletConnect
- View your transaction history from Etherscan
- Real-time transaction updates via WebSocket connection to the Ethereum network
- Tag and label Ethereum addresses
- Store transactions and tags in Supabase database for persistence
- Fallback to mock data when API keys aren't configured

## WebSocket Implementation

This application uses a standalone Socket.io server that runs alongside Next.js to provide real-time updates. The server:

1. Fetches historical transaction data from Etherscan API
2. Establishes a WebSocket connection to the Ethereum network via Infura
3. Listens for new transactions related to the connected wallet address
4. Streams real-time transaction updates to the client
5. Stores transaction data in Supabase for persistence
6. Falls back to mock data generation if API connections fail

## Database Implementation

The application uses Supabase as a backend database for:

1. Storing transaction history for quick access without relying on blockchain APIs
2. Saving user-created address tags for persistent labeling
3. Providing faster access to historical data

## Testing the Socket Connection

You can test the socket connection separately:

```bash
pnpm test-socket
# or
npm run test-socket
```

This connects to the socket server and logs transaction updates for a test wallet address.

## Troubleshooting

If you experience connection issues:

1. Check your API keys are correctly configured in `.env.local`
2. Make sure both the socket server and Next.js development server are running
3. Check browser console and server logs for error messages
4. Verify that port 3000 isn't in use by other applications
5. Try restarting both servers if connection problems persist

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Socket.io Documentation](https://socket.io/docs/v4/) - learn about Socket.io.
- [Supabase Documentation](https://supabase.com/docs) - learn about Supabase.

## Deploy on Vercel

For production deployment, you'll need to adjust the Socket.io server configuration to work with serverless environments or deploy the socket server separately.

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
