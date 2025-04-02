import { NextResponse } from 'next/server';
import supabase from '@/utils/supabase';

export async function GET(request) {
  // Handle CORS preflight request
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
    });
  }

  try {
    console.log('DEBUG: /api/debug/tags - Direct tag check');
    
    // 1. Direct query to the database
    const { data: dbTags, error: dbError } = await supabase
      .from('tags')
      .select('*');
      
    if (dbError) {
      console.error('Database query error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }
    
    // 2. Process the tags the same way as the main API
    const formattedTags = dbTags.map(tag => {
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
        id: `${walletAddress}_${targetAddress}`,
        address: targetAddress,
        tag: tag.tag_name,
        created_by: walletAddress,
        signature: 'verified',
        created_at: tag.created_at
      };
    });
    
    // 3. Return detailed debugging information with CORS headers
    return NextResponse.json({
      status: 'success',
      raw_db_response: {
        count: dbTags.length,
        items: dbTags
      },
      formatted_tags: {
        count: formattedTags.length,
        items: formattedTags
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  } catch (error) {
    console.error('Debug tags error:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
} 