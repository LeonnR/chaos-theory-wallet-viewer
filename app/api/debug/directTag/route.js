import { NextResponse } from 'next/server';
import supabase, { supabaseConfig } from '@/utils/supabase';

export async function GET(request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet') || '0x1234567890abcdef1234567890abcdef12345678'; 
    const target = searchParams.get('target') || '0xabcdef1234567890abcdef1234567890abcdef12';
    const tagName = searchParams.get('tag') || 'DirectTestTag';
    
    // Prepare tag data
    const tagData = {
      wallet_address: wallet.toLowerCase(),
      target_address: target.toLowerCase(),
      tag_name: tagName,
      created_at: new Date().toISOString()
    };
    
    console.log('Creating tag with direct API:', tagData);
    
    // Try all insert methods
    let results = {};
    
    // Method 1: Standard upsert
    try {
      const result1 = await supabase
        .from('tags')
        .upsert(tagData);
      
      results.upsert = {
        success: !result1.error,
        error: result1.error ? result1.error.message : null
      };
    } catch (e) {
      results.upsert = { success: false, error: e.message };
    }
    
    // Method 2: Insert
    try {
      const result2 = await supabase
        .from('tags')
        .insert([tagData]);
      
      results.insert = {
        success: !result2.error,
        error: result2.error ? result2.error.message : null
      };
    } catch (e) {
      results.insert = { success: false, error: e.message };
    }
    
    // Method 3: Raw SQL
    try {
      const result3 = await supabase
        .rpc('custom_insert_tag', {
          wallet: tagData.wallet_address,
          target: tagData.target_address,
          tag: tagData.tag_name
        })
        .single();
      
      results.rpc = {
        success: !result3.error,
        error: result3.error ? result3.error.message : null
      };
    } catch (e) {
      results.rpc = { success: false, error: e.message };
    }
    
    // Check if tag exists in database now
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('wallet_address', tagData.wallet_address)
      .eq('target_address', tagData.target_address);
    
    const success = results.upsert.success || results.insert.success || results.rpc.success;
    
    return NextResponse.json({
      status: success ? 'success' : 'error',
      message: success ? 'Tag created with at least one method' : 'All creation methods failed',
      methods: results,
      data: data || [],
      queryError: error ? error.message : null,
      supabaseConfig: {
        hasUrl: supabaseConfig.hasUrl,
        hasKey: supabaseConfig.hasKey
      }
    });
  } catch (error) {
    console.error('Error in direct tag creation:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message
    }, { status: 500 });
  }
} 