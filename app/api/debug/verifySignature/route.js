import { NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { ethers } from 'ethers';
import { validateSignature } from '@/utils/validation';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST endpoint for testing signature verification
export async function POST(request) {
  try {
    console.log('Signature verification debug endpoint called');
    
    const body = await request.json();
    const { message, signature, address } = body;
    
    console.log('Received verification request:', {
      messageLength: message?.length,
      signatureLength: signature?.length,
      address
    });
    
    if (!message || !signature || !address) {
      return NextResponse.json({
        valid: false,
        error: 'Missing required fields',
        message: !!message,
        signature: !!signature,
        address: !!address
      }, { headers: corsHeaders });
    }
    
    // Use utility function to validate
    const validationResult = await validateSignature(message, signature, address);
    
    // Also try direct viem validation
    let viemResult;
    try {
      const isValid = await verifyMessage({
        address,
        message,
        signature
      });
      
      viemResult = {
        success: isValid,
        method: 'viem.verifyMessage',
        message: isValid ? 'Verification successful' : 'Verification failed'
      };
    } catch (viemError) {
      viemResult = {
        success: false,
        error: viemError.message,
        method: 'viem.verifyMessage'
      };
      
      // Try direct ethers as fallback
      try {
        const recoveredAddress = ethers.utils.verifyMessage(message, signature);
        const isEthersValid = recoveredAddress.toLowerCase() === address.toLowerCase();
        
        viemResult.ethers = {
          success: isEthersValid,
          recoveredAddress,
          method: 'ethers.utils.verifyMessage',
          matches: isEthersValid
        };
      } catch (ethersError) {
        viemResult.ethers = {
          success: false,
          error: ethersError.message,
          method: 'ethers.utils.verifyMessage'
        };
      }
    }
    
    return NextResponse.json({
      utilityValidation: validationResult,
      directValidation: viemResult,
      timestamp: new Date().toISOString()
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error in signature verification endpoint:', error);
    return NextResponse.json({
      valid: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500, headers: corsHeaders });
  }
}

// GET endpoint for simple testing
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const message = searchParams.get('message') || 'Test message';
  const testWallet = ethers.Wallet.createRandom();
  
  try {
    // Sign the message with a random test wallet
    const signature = await testWallet.signMessage(message);
    
    // Verify with viem first
    let viemValid = false;
    try {
      viemValid = await verifyMessage({
        address: testWallet.address,
        message,
        signature
      });
    } catch (viemError) {
      console.warn('Viem verification failed in test:', viemError.message);
    }
    
    // Verify with ethers as fallback
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    const ethersValid = recoveredAddress.toLowerCase() === testWallet.address.toLowerCase();
    
    return NextResponse.json({
      testResult: viemValid || ethersValid ? 'Verification works correctly' : 'Verification failed',
      viemValid,
      ethersValid,
      message,
      wallet: testWallet.address,
      recoveredAddress,
      signature: signature,
      timestamp: new Date().toISOString()
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500, headers: corsHeaders });
  }
} 