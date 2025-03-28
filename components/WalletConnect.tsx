'use client'

import { useEffect, useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'

export default function WalletConnect() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const [mounted, setMounted] = useState(false)
  const appKit = useAppKit()

  // This is needed because we're using hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Wait until after client-side hydration to show
  if (!mounted) return null

  return (
    <div className="mb-6 flex justify-center">
      {isConnected ? (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => disconnect()}
            className="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-medium py-2.5 px-6 rounded-lg transition-all duration-300 shadow-[0_4px_15px_rgba(90,50,180,0.2)] hover:shadow-[0_4px_20px_rgba(120,80,220,0.35)] flex items-center relative overflow-hidden"
          >
            <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-600/10 to-indigo-600/10 blur opacity-0 hover:opacity-100 transition-opacity pointer-events-none"></span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
            <span className="relative z-10">Disconnect Wallet</span>
          </button>
          <span className="text-sm text-purple-300/80">
            Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </div>
      ) : (
        <button
          onClick={() => appKit.open()}
          className="bg-gradient-to-br from-purple-500 to-indigo-700 hover:from-purple-400 hover:to-indigo-600 text-white font-bold py-3.5 px-10 rounded-lg transition-all duration-300 shadow-[0_4px_20px_rgba(120,80,220,0.3)] hover:shadow-[0_4px_30px_rgba(140,100,255,0.45)] flex items-center relative overflow-hidden group"
        >
          <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-500/20 to-indigo-600/20 blur opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></span>
          <span className="absolute -inset-1 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 group-hover:duration-200 pointer-events-none"></span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="relative z-10">Connect Wallet</span>
        </button>
      )}
    </div>
  )
} 