import { NextResponse } from 'next/server';
import supabase, { supabaseConfig } from '@/utils/supabase';

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

// GET creates a test tag using query parameters
export async function GET(request) {
  try {
    console.log('DEBUG: Direct tag creation endpoint accessed');
    
    // Get URL parameters
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address') || '0xtest' + Date.now();
    const wallet = searchParams.get('wallet') || '0xuser' + Date.now();
    const tagName = searchParams.get('tagName') || 'DebugTag';
    
    console.log('Creating debug tag with parameters:', { address, wallet, tagName });
    
    // Prepare tag data
    const tagData = {
      wallet_address: wallet.toLowerCase(),
      target_address: address.toLowerCase(),
      tag_name: tagName,
      created_at: new Date().toISOString()
    };
    
    // Check Supabase connection
    console.log('Supabase connection status:', { 
      hasUrl: supabaseConfig.hasUrl, 
      hasKey: supabaseConfig.hasKey,
      url: supabaseConfig.url ? supabaseConfig.url.substring(0, 10) + '...' : 'Missing'
    });
    
    // Try to save the tag
    let savedData;
    const { data, error } = await supabase
      .from('tags')
      .upsert(tagData, { 
        onConflict: 'wallet_address,target_address',
        returning: 'representation'
      });
    
    if (error) {
      console.error('Error saving debug tag:', error);
      
      // Try alternative insert method
      const insertResult = await supabase
        .from('tags')
        .insert([tagData])
        .select();
        
      if (insertResult.error) {
        throw new Error(`Both upsert and insert failed: ${error.message} / ${insertResult.error.message}`);
      } else {
        console.log('Insert succeeded using alternative method');
        savedData = insertResult.data;
      }
    } else {
      savedData = data;
    }
    
    // Check if tag was saved by querying it back
    const { data: verifyData, error: verifyError } = await supabase
      .from('tags')
      .select('*')
      .eq('wallet_address', tagData.wallet_address)
      .eq('target_address', tagData.target_address);
    
    // Format response for client expectations
    const formattedTag = {
      id: `${wallet.toLowerCase()}_${address.toLowerCase()}`,
      address: address.toLowerCase(),
      tag: tagName,
      created_by: wallet.toLowerCase(),
      signature: 'debug-bypassed',
      created_at: tagData.created_at
    };
    
    return NextResponse.json({
      status: 'success',
      message: 'Debug tag created',
      tag: formattedTag,
      rawData: savedData,
      verification: {
        found: verifyData && verifyData.length > 0,
        data: verifyData,
        error: verifyError ? verifyError.message : null
      },
      supabase: {
        configured: supabaseConfig.hasUrl && supabaseConfig.hasKey
      }
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Debug tag creation failed:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500, headers: corsHeaders });
  }
} 