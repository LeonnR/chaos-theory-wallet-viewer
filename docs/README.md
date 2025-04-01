# Wallet Transaction Viewer Documentation

Welcome to the documentation for the Wallet Transaction Viewer application. This repository contains comprehensive documentation for both users and developers.

## Documentation Index

### For Users
- [User Guide](USER_GUIDE.md) - A guide for end users explaining how to use the application

### For Developers
- [Developer Documentation](DOCUMENTATION.md) - Technical documentation for developers

### Quick Links

- **Setup and Installation**: [View setup instructions](DOCUMENTATION.md#setup-and-installation)
- **Architecture Overview**: [View architecture details](DOCUMENTATION.md#architecture)
- **API Reference**: [View API documentation](DOCUMENTATION.md#api-reference)
- **Database Schema**: [View database schema](DOCUMENTATION.md#database-schema)
- **Troubleshooting**: [View troubleshooting tips](DOCUMENTATION.md#troubleshooting)

## Project Overview

The Wallet Transaction Viewer is a real-time Ethereum wallet transaction monitoring application built with Next.js and Socket.io. It allows users to connect their wallets and view transaction history with real-time updates without requiring page refreshes.

Key features include:
- Wallet connection via WalletConnect
- Real-time transaction updates via WebSocket
- Transaction history viewing and filtering
- Address tagging for easy identification
- Persistent storage of tags in a database

## Quick Start

For developers looking to set up the project quickly:

```bash
# Clone the repository
git clone https://github.com/yourusername/wallet-transaction-viewer.git
cd wallet-transaction-viewer

# Install dependencies
npm install

# Set up environment variables
npm run create-env

# Start the socket server (in one terminal)
npm run socket-server

# Start the Next.js development server (in another terminal)
npm run dev
```

For more detailed instructions, see the [Developer Documentation](DOCUMENTATION.md). 