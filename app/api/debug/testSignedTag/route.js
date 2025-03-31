import { NextResponse } from 'next/server';
import { verifyMessage, recoverMessageAddress } from 'viem';
import { ethers } from 'ethers';
import supabase, { supabaseConfig } from '@/utils/supabase';
import { normalize } from 'viem/ens';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper function to validate Ethereum addresses
function isValidEthereumAddress(address) {
  if (!address) return false;
  try {
    // Check if it's a valid format (0x followed by 40 hex characters)
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  } catch (error) {
    console.error('Error validating Ethereum address:', error);
    return false;
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET endpoint for testing tag creation with a test wallet and signature
export async function GET(request) {
  try {
    console.log('🧪 DEBUG TEST SIGNED TAG endpoint called');
    console.log('Request URL:', request.url);
    
    // Log referrer and other important headers to trace where the request came from
    const referrer = request.headers.get('referer') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const origin = request.headers.get('origin') || 'unknown';
    
    console.log('Request source details:', {
      referrer,
      origin,
      userAgent: userAgent.substring(0, 50) + '...' // Truncate for readability
    });
    
    // Add stack trace to see what's calling this endpoint
    const stackTrace = new Error().stack;
    console.log('Stack trace for this endpoint call:');
    console.log(stackTrace);
    
    // Capture URL params if any to see if real app data is being sent here
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('address');
    const userWallet = searchParams.get('wallet');
    const userTag = searchParams.get('tag');
    
    // Check for unexpected calls with real user data
    if (userAddress || userWallet || userTag) {
      console.warn('⚠️ WARNING: Test endpoint received what appears to be real user data:', {
        userAddress,
        userWallet,
        userTag
      });
      
      // If this looks like a real tag request that shouldn't be here,
      // add special handling to avoid test data being saved
      if (isValidEthereumAddress(userAddress) && 
          isValidEthereumAddress(userWallet) && 
          userTag && 
          userTag !== 'TestSignedTag') {
        // This appears to be a misrouted real tag request
        console.error('🚨 CRITICAL: This appears to be a real tag request incorrectly routed to the test endpoint!');
        console.log('Returning error response rather than creating test tag');
        
        return NextResponse.json({
          error: 'This test endpoint was called with real user data. This indicates a routing or API call issue in your application.',
          userDataDetected: true,
          action: 'aborted',
          message: 'The test endpoint refused to process what appears to be real user data to protect your database'
        }, { status: 400, headers: corsHeaders });
      } 
    }

    // Log any data that would end up in the database from this call
    console.log('⚠️ This endpoint will create a database entry with MOCK/TEST DATA:', {
      testAddress: '0x1234567890123456789012345678901234567890',
      testTag: 'TestSignedTag'
    });
    
    // Generate a test wallet
    const testWallet = ethers.Wallet.createRandom();
    const address = "0x1234567890123456789012345678901234567890"; // Target address
    const tag = "TestSignedTag";
    
    // Create the exact same message format used in the real system
    const message = `I want to create a tag "${tag}" for address ${address}`;
    
    // Sign the message with our test wallet
    const signature = await testWallet.signMessage(message);
    
    console.log('Test setup complete:', {
      wallet: testWallet.address,
      messageToSign: message,
      signatureGenerated: signature,
      signatureLength: signature.length
    });
    
    // Now attempt to verify this signature using the same methods as our main endpoint
    const viemVerifyResult = await verifyMessage({
      address: testWallet.address,
      message,
      signature
    });
    
    const viemRecoverResult = await recoverMessageAddress({
      message,
      signature
    });
    
    const ethersVerifyResult = ethers.utils.verifyMessage(message, signature);
    
    // Attempt to insert a tag using this test data
    const tagData = {
      wallet_address: testWallet.address.toLowerCase(),
      target_address: address.toLowerCase(),
      tag_name: tag,
      created_at: new Date().toISOString()
    };
    
    let dbResult;
    try {
      const { data, error } = await supabase
        .from('tags')
        .upsert(tagData, {
          onConflict: 'wallet_address,target_address',
          returning: 'representation'
        });
      
      dbResult = { success: !error, data, error: error?.message };
    } catch (dbError) {
      dbResult = { success: false, error: dbError.message };
    }
    
    // Verify the tag was saved
    let verifyResult;
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('wallet_address', testWallet.address.toLowerCase())
        .eq('target_address', address.toLowerCase());
      
      verifyResult = { success: !error, count: data?.length, data, error: error?.message };
    } catch (verifyError) {
      verifyResult = { success: false, error: verifyError.message };
    }
    
    return NextResponse.json({
      testSetup: {
        testWallet: testWallet.address,
        message,
        signature,
        signatureLength: signature.length
      },
      verification: {
        viemVerifyResult,
        viemRecoverAddress: viemRecoverResult,
        viemRecoverMatches: viemRecoverResult.toLowerCase() === testWallet.address.toLowerCase(),
        ethersRecoverAddress: ethersVerifyResult,
        ethersRecoverMatches: ethersVerifyResult.toLowerCase() === testWallet.address.toLowerCase()
      },
      databaseOperation: {
        dbResult,
        verifyResult
      },
      timestamp: new Date().toISOString()
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error in test signed tag endpoint:', error);
    return NextResponse.json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500, headers: corsHeaders });
  }
} 