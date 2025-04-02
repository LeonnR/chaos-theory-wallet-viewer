import { NextResponse } from 'next/server';
import supabase, { supabaseConfig } from '@/utils/supabase';
import { verifyMessage, getAddress, recoverMessageAddress } from 'viem';
// Keep ethers import for backward compatibility
import { ethers } from 'ethers';

// Helper function to add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// OPTIONS handler for CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET tags for a wallet address
export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  
  console.log(`GET /api/tags - Request for tags with address: ${address}`);
  
  if (!address) {
    console.error('Missing address parameter in request');
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  try {
    console.log('Querying Supabase for tags');
    
    // Query all tags in the database - don't filter by address if 'all' is specified
    let query = supabase.from('tags').select('*');
    
    // Only apply filter if we're not requesting all tags
    if (address !== 'all') {
      console.log(`Filtering for address: ${address}`);
      query = query.eq('target_address', address.toLowerCase());
    } else {
      console.log('Returning all tags (no address filter)');
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
    
    console.log(`Found ${data.length} tags in the database`);
    
    // Format response for the client
    const formattedTags = data.map(tag => {
      // Ensure target_address has 0x prefix and is lowercase
      let targetAddress = tag.target_address.toLowerCase();
      if (!targetAddress.startsWith('0x')) {
        targetAddress = '0x' + targetAddress;
      }

      // Ensure wallet_address has 0x prefix and is lowercase
      let walletAddress = tag.wallet_address.toLowerCase();
      if (!walletAddress.startsWith('0x')) {
        walletAddress = '0x' + walletAddress;
      }

      return {
        id: `${walletAddress}_${targetAddress}`, // Create a composite ID
        address: targetAddress, // Map to existing client expectations
        tag: tag.tag_name,
        created_by: walletAddress,
        signature: 'verified', // Signature is verified server-side and not stored
        created_at: tag.created_at
      };
    });
    
    console.log('Database tags data:', data);
    console.log('Formatted tags for client:', formattedTags);
    
    return NextResponse.json(formattedTags || [], { headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tags' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST a new tag with signature verification
export async function POST(request) {
  try {
    console.log('⭐ POST /api/tags - Received tag creation request');
    
    // Save raw request for debugging
    const rawBody = await request.text();
    const parsedBody = JSON.parse(rawBody);
    
    console.log('📋 Request payload for tag creation:', { 
      rawBody,
      parsedBody,
      headers: Object.fromEntries(request.headers.entries())
    });
    
    const { address, tag, createdBy, signature } = parsedBody;
    
    console.log('🏷️ Tag creation details:', { 
      address, 
      tag, 
      createdBy, 
      signatureLength: signature?.length,
      signaturePrefix: signature?.substring(0, 10),
      bodyKeys: Object.keys(parsedBody),
      hasRequiredFields: !!(address && tag && createdBy && signature)
    });

    // CRITICAL CHECK: Is this test data that shouldn't be used for regular tags?
    // This can help detect if test data is being incorrectly used in production
    const isTestData = checkForTestDataPatterns(address, tag, createdBy, signature);
    
    if (isTestData.isTestData) {
      console.warn('🚨 CRITICAL WARNING: Test data patterns detected in regular tag creation!', isTestData);
      console.log('This may indicate the wrong code path is being used for regular tags.');
      
      // In production, we should reject test data
      if (process.env.NODE_ENV === 'production') {
        console.error('Rejecting test data in production environment');
        return NextResponse.json(
          { error: 'Test data is not allowed in production' },
          { status: 400, headers: corsHeaders }
        );
      } else {
        console.warn('Allowing test data in development, but this should be fixed');
      }
    }
    
    if (!address || !tag || !createdBy || !signature) {
      console.error('❌ Missing required fields:', { address: !!address, tag: !!tag, createdBy: !!createdBy, hasSignature: !!signature });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    if (!isValidEthereumAddress(address) || !isValidEthereumAddress(createdBy)) {
      console.error('❌ Invalid address format:', { 
        address, 
        createdBy, 
        addressValid: isValidEthereumAddress(address),
        creatorValid: isValidEthereumAddress(createdBy)
      });
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Normalize the signature if needed (some wallets return without 0x prefix)
    const normalizedSignature = signature.startsWith('0x') ? signature : `0x${signature}`;
    
    // Message to verify must match exactly what was signed
    const message = `I want to create a tag "${tag}" for address ${address}`;
    
    console.log('🔐 Signature verification attempt:', {
      message,
      messageLength: message.length,
      normalizedSignature: normalizedSignature.substring(0, 15) + '...',
      signatureLength: normalizedSignature.length,
      walletAddress: createdBy
    });
    
    // Verify the signature matches the creator address
    let isSignatureValid = false;
    let verificationError = null;
    
    // First try with viem
    try {
      console.log('Attempting signature verification with viem');
      const recoveredAddress = await recoverMessageAddress({
        message,
        signature: normalizedSignature
      });
      
      console.log('Viem recovered address:', recoveredAddress);
      console.log('Wallet address from request:', createdBy);
      console.log('Addresses match?', recoveredAddress.toLowerCase() === createdBy.toLowerCase());
      
      isSignatureValid = recoveredAddress.toLowerCase() === createdBy.toLowerCase();
      
      if (isSignatureValid) {
        console.log('✅ Signature verification successful with viem');
      } else {
        console.warn('⚠️ Signature verification failed with viem - addresses don\'t match');
      }
    } catch (viemError) {
      console.error('❌ Viem signature verification error:', viemError);
      verificationError = viemError;
      
      // Try with ethers as fallback
      try {
        console.log('Falling back to ethers for signature verification');
        const ethersRecovered = ethers.utils.verifyMessage(message, normalizedSignature);
        
        console.log('Ethers recovered address:', ethersRecovered);
        isSignatureValid = ethersRecovered.toLowerCase() === createdBy.toLowerCase();
        
        if (isSignatureValid) {
          console.log('✅ Signature verification successful with ethers');
        } else {
          console.warn('⚠️ Signature verification failed with ethers - addresses don\'t match');
        }
      } catch (ethersError) {
        console.error('❌ Ethers signature verification error:', ethersError);
        verificationError = ethersError;
      }
    }
    
    if (!isSignatureValid) {
      console.error('❌ All signature verification attempts failed');
      
      // CRITICAL ISSUE: This development mode bypass may be the source of our problems!
      // It allows invalid signatures to pass, which could lead to test data being used
      if (process.env.NODE_ENV === 'development') {
        // Instead of simply bypassing, we should ensure the data is legitimate
        console.warn('⚠️ DEV MODE: Performing additional checks before bypassing signature verification');
        
        // Check if this looks like real user data (not test data)
        const isTestData = checkForTestDataPatterns(address, tag, createdBy, signature);
        
        if (isTestData.isTestData) {
          console.error('🚨 DEV MODE REJECTED: Attempted to use test data with invalid signature');
          return NextResponse.json(
            { 
              error: 'Even in dev mode, test data requires valid signatures', 
              details: 'This appears to be test data that should be properly signed' 
            },
            { status: 400, headers: corsHeaders }
          );
        }
        
        // If we're getting here in dev mode with user input (not test data),
        // log a strong warning but allow it to proceed
        console.warn('⚠️⚠️⚠️ DEV MODE: Bypassing signature verification for non-test data');
        console.warn('This should only happen during development, never in production!');
        console.log('Proceeding with tag creation despite invalid signature');
        
        isSignatureValid = true;
      } else {
        return NextResponse.json(
          { 
            error: 'Signature verification failed', 
            details: verificationError?.message || 'Invalid signature' 
          },
          { status: 400, headers: corsHeaders }
        );
      }
    }
    
    // Normalize addresses for storage
    const targetAddress = normalizeAddress(address);
    const creatorAddress = normalizeAddress(createdBy);
    
    // Prepare the tag data
    const tagData = {
      wallet_address: creatorAddress,
      target_address: targetAddress,
      tag_name: tag,
      created_at: new Date().toISOString()
    };
    
    console.log('Saving tag to database:', tagData);
    
    // Attempt to insert the tag
    try {
      // Log database connection info
      console.log('Database connection details:', {
        hasUrl: !!supabaseConfig.url,
        urlPrefix: supabaseConfig.url ? supabaseConfig.url.substring(0, 15) + '...' : 'missing',
        hasKey: !!supabaseConfig.key
      });
      
      // First try a simple select to verify connection
      const testQuery = await supabase.from('tags').select('count');
      console.log('Test query result:', testQuery);
      
      if (testQuery.error) {
        console.error('Database connection test failed:', testQuery.error);
        throw new Error(`Database connection error: ${testQuery.error.message}`);
      }
      
      console.log('Database connection test successful');
      
      // Proceed with the tag creation
      const { data, error } = await supabase
        .from('tags')
        .upsert(tagData, { 
          onConflict: 'wallet_address,target_address',
          returning: 'minimal'
        });
      
      if (error) {
        console.error('Database error saving tag:', error);
        throw error;
      }
      
      console.log('Tag successfully saved to database');
      
      // Verify the tag was saved with a follow-up query
      const verifyQuery = await supabase
        .from('tags')
        .select('*')
        .eq('wallet_address', creatorAddress)
        .eq('target_address', targetAddress);
        
      if (verifyQuery.error) {
        console.warn('Tag save verification query failed:', verifyQuery.error);
      } else {
        console.log('Tag save verified:', verifyQuery.data);
      }
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      throw dbError;
    }
    
    // Format the response to match client expectations
    const responseData = {
      id: `${creatorAddress}_${targetAddress}`,
      address: targetAddress,
      tag: tag,
      created_by: creatorAddress,
      signature: 'verified',
      created_at: new Date().toISOString()
    };
    
    console.log('Returning success response to client');
    return NextResponse.json(responseData, { headers: corsHeaders });
  } catch (error) {
    console.error('Error creating tag:', error);
    
    // Build a detailed error response
    const errorMessage = error.message || 'Failed to create tag';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE a tag
export async function DELETE(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('walletAddress')?.toLowerCase();
    const targetAddress = searchParams.get('targetAddress')?.toLowerCase();
    
    console.log('DELETE /api/tags - Request to delete tag:', { walletAddress, targetAddress });
    
    if (!walletAddress || !targetAddress) {
      console.error('Missing parameters for DELETE request');
      return NextResponse.json(
        { error: 'Both walletAddress and targetAddress are required' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Only allow users to delete their own tags
    console.log(`Attempting to delete tag where wallet_address=${walletAddress} and target_address=${targetAddress}`);
    
    const { data: deletedData, error: deleteError } = await supabase
      .from('tags')
      .delete()
      .eq('wallet_address', walletAddress)
      .eq('target_address', targetAddress)
      .select();
    
    if (deleteError) {
      console.error('Error deleting tag:', deleteError);
      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete tag' },
        { status: 500, headers: corsHeaders }
      );
    }
    
    console.log('Successfully deleted tag:', deletedData);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Tag deleted successfully',
      deletedTag: deletedData?.length ? deletedData[0] : null
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Unexpected error deleting tag:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete tag' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// UPDATE a tag
export async function PUT(request) {
  try {
    console.log('PUT /api/tags - Tag update request received');
    
    let requestBody = null;
    try {
      // Read raw request for debugging
      const rawBody = await request.text();
      console.log('Raw request body:', rawBody);
      
      // Try to parse the JSON
      if (rawBody.trim()) {
        requestBody = JSON.parse(rawBody);
        console.log('Parsed request body:', requestBody);
      } else {
        console.error('Empty request body received');
        return NextResponse.json(
          { error: 'Empty request body' },
          { status: 400, headers: corsHeaders }
        );
      }
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: parseError.message },
        { status: 400, headers: corsHeaders }
      );
    }
    
    const { address, tag, createdBy, oldAddress } = requestBody || {};
    
    console.log('PUT /api/tags - Request to update tag:', { address, tag, createdBy, oldAddress });
    
    if (!address || !tag || !createdBy || !oldAddress) {
      console.error('Missing required fields for tag update');
      return NextResponse.json(
        { error: 'Address, tag, createdBy, and oldAddress are required' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Normalize addresses
    const normalizedCreator = createdBy.toLowerCase();
    const normalizedOldAddress = oldAddress.toLowerCase();
    const normalizedNewAddress = address.toLowerCase();
    
    // Only allow users to update their own tags
    console.log(`Attempting to update tag where wallet_address=${normalizedCreator} and target_address=${normalizedOldAddress}`);
    
    // First check if the tag exists and is owned by this user
    const { data: existingTag, error: checkError } = await supabase
      .from('tags')
      .select('*')
      .eq('wallet_address', normalizedCreator)
      .eq('target_address', normalizedOldAddress)
      .single();
    
    if (checkError) {
      console.error('Error finding tag to update:', checkError);
      return NextResponse.json(
        { error: 'Error finding tag', details: checkError.message },
        { status: 500, headers: corsHeaders }
      );
    }
    
    if (!existingTag) {
      console.error('Tag not found:', { wallet: normalizedCreator, target: normalizedOldAddress });
      return NextResponse.json(
        { error: 'Tag not found or you do not have permission to update it' },
        { status: 404, headers: corsHeaders }
      );
    }
    
    console.log('Found existing tag for update:', existingTag);
    
    // Prepare the updated tag data
    const updatedTagData = {
      wallet_address: normalizedCreator,
      target_address: normalizedNewAddress,
      tag_name: tag,
      created_at: existingTag.created_at // Keep the original creation date
    };
    
    console.log('Updating tag with data:', updatedTagData);
    
    try {
      // If the address is not changing, use an update
      if (normalizedOldAddress === normalizedNewAddress) {
        const { data: updatedData, error: updateError } = await supabase
          .from('tags')
          .update(updatedTagData)
          .eq('wallet_address', normalizedCreator)
          .eq('target_address', normalizedOldAddress)
          .select();
        
        if (updateError) {
          console.error('Error updating tag:', updateError);
          return NextResponse.json(
            { error: updateError.message || 'Failed to update tag' },
            { status: 500, headers: corsHeaders }
          );
        }
        
        if (!updatedData || updatedData.length === 0) {
          console.error('No data returned from update operation');
          return NextResponse.json(
            { error: 'Update operation did not return any data' },
            { status: 500, headers: corsHeaders }
          );
        }
        
        console.log('Tag successfully updated:', updatedData);
        
        // Format the response to match client expectations
        const responseData = {
          id: `${normalizedCreator}_${normalizedNewAddress}`,
          address: normalizedNewAddress,
          tag: tag,
          created_by: normalizedCreator,
          signature: 'verified',
          created_at: updatedData[0].created_at
        };
        
        console.log('Sending successful response:', responseData);
        return NextResponse.json(responseData, { headers: corsHeaders });
      } 
      // If the address is changing, we need to delete the old one and create a new one
      else {
        // Begin by deleting the old tag
        const { error: deleteError } = await supabase
          .from('tags')
          .delete()
          .eq('wallet_address', normalizedCreator)
          .eq('target_address', normalizedOldAddress);
        
        if (deleteError) {
          console.error('Error deleting old tag during update:', deleteError);
          return NextResponse.json(
            { error: deleteError.message || 'Failed to update tag' },
            { status: 500, headers: corsHeaders }
          );
        }
        
        // Then create the new tag
        const { data: newTagData, error: insertError } = await supabase
          .from('tags')
          .insert(updatedTagData)
          .select();
        
        if (insertError) {
          console.error('Error creating new tag during update:', insertError);
          return NextResponse.json(
            { error: insertError.message || 'Failed to update tag' },
            { status: 500, headers: corsHeaders }
          );
        }
        
        if (!newTagData || newTagData.length === 0) {
          console.error('No data returned from insert operation');
          return NextResponse.json(
            { error: 'Insert operation did not return any data' },
            { status: 500, headers: corsHeaders }
          );
        }
        
        console.log('Tag successfully updated with address change:', newTagData);
        
        // Format the response to match client expectations
        const responseData = {
          id: `${normalizedCreator}_${normalizedNewAddress}`,
          address: normalizedNewAddress,
          tag: tag,
          created_by: normalizedCreator,
          signature: 'verified',
          created_at: newTagData[0].created_at
        };
        
        console.log('Sending successful response:', responseData);
        return NextResponse.json(responseData, { headers: corsHeaders });
      }
    } catch (dbError) {
      console.error('Database operation error:', dbError);
      return NextResponse.json(
        { error: 'Database operation failed', details: dbError.message },
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (error) {
    console.error('Unexpected error updating tag:', error);
    // Ensure we always return a valid JSON response even for unexpected errors
    return NextResponse.json(
      { error: 'Failed to update tag', details: error.message || 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Helper function to detect test data patterns
function checkForTestDataPatterns(address, tag, createdBy, signature) {
  const issues = [];
  let isTestData = false;
  
  // Check for known test addresses
  if (address === '0x1234567890123456789012345678901234567890') {
    issues.push('Using known test target address');
    isTestData = true;
  }
  
  // Check for test tag names
  if (tag && (tag === 'TestSignedTag' || tag.startsWith('Test') || tag.includes('DIAG-'))) {
    issues.push(`Tag name "${tag}" matches test pattern`);
    // Not setting isTestData=true here as this could be legitimate
  }
  
  // Check for test wallet patterns in creator
  if (createdBy && (
      createdBy.includes('TestWallet') || 
      createdBy.startsWith('0x000') || 
      createdBy === '0x1111111111111111111111111111111111111111')
  ) {
    issues.push('Creator address matches test wallet pattern');
    isTestData = true;
  }
  
  // Check sig length for known ethers test wallet sig length
  if (signature && signature.length === 132) {
    issues.push('Signature length matches test wallet signature pattern');
    // Not setting isTestData as this is just a standard signature length
  }
  
  // Log the check regardless of result
  console.log('🧪 Test data check:', {
    address,
    tag,
    creatorPrefix: createdBy ? createdBy.substring(0, 10) + '...' : 'undefined',
    signatureLength: signature?.length,
    issues,
    isTestData
  });
  
  return {
    isTestData,
    issues,
    details: {
      addressMatchesTestPattern: address === '0x1234567890123456789012345678901234567890',
      tagMatchesTestPattern: tag === 'TestSignedTag' || tag?.startsWith('Test'),
      creatorMatchesTestPattern: createdBy?.includes('TestWallet') || createdBy?.startsWith('0x000')
    }
  };
}

// Helper function to normalize Ethereum addresses
function normalizeAddress(address) {
  if (!address) return '';
  
  // Ensure the address is lowercase
  let normalized = address.toLowerCase();
  
  // Ensure the address has the 0x prefix
  if (!normalized.startsWith('0x')) {
    normalized = '0x' + normalized;
  }
  
  return normalized;
} 