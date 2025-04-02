import { NextResponse } from 'next/server';
import supabase, { supabaseConfig } from '@/utils/supabase';

export async function GET(request) {
  try {
    // Get URL parameters or use test data
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet') || '0x1234567890abcdef1234567890abcdef12345678';
    const targetAddress = searchParams.get('target') || '0xabcdef1234567890abcdef1234567890abcdef12';
    const tagName = searchParams.get('tag') || 'TestTag';
    
    // Prepare test tag data
    const tagData = {
      wallet_address: walletAddress.toLowerCase(),
      target_address: targetAddress.toLowerCase(),
      tag_name: tagName,
      created_at: new Date().toISOString()
    };
    
    console.log('Test tag data:', tagData);
    
    // Connection check
    const connectionStatus = {
      url: supabaseConfig.hasUrl,
      key: supabaseConfig.hasKey,
      supabaseUrl: supabaseConfig.url ? `${supabaseConfig.url.substring(0, 8)}...` : 'Missing'
    };
    
    // Attempt to insert the test tag
    const { data, error } = await supabase
      .from('tags')
      .upsert(tagData)
      .select();
    
    // Get current tags in the table
    const { data: allTags, error: listError } = await supabase
      .from('tags')
      .select('*')
      .limit(10);
    
    // Check if the tag was actually inserted
    const { data: checkData, error: checkError } = await supabase
      .from('tags')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('target_address', targetAddress.toLowerCase())
      .single();
    
    return NextResponse.json({
      status: error ? 'error' : 'success',
      connection: connectionStatus,
      insertOperation: {
        success: !error,
        error: error ? error.message : null,
        data: data
      },
      verification: {
        found: !!checkData,
        data: checkData || null,
        error: checkError ? checkError.message : null
      },
      tableData: {
        tags: allTags || [],
        error: listError ? listError.message : null
      }
    });
  } catch (error) {
    console.error('Test tag insertion error:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 