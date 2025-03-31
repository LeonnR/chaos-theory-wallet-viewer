import { NextResponse } from 'next/server';
import supabase, { supabaseConfig } from '@/utils/supabase';

export async function GET() {
  try {
    // Test if we can insert a record
    const testTag = {
      wallet_address: '0xtest' + Date.now(),
      target_address: '0xtest' + Date.now(),
      tag_name: 'RLS_TEST',
      created_at: new Date().toISOString()
    };
    
    console.log('Testing RLS with test tag:', testTag);
    
    // Try insert
    const { data: insertData, error: insertError } = await supabase
      .from('tags')
      .insert([testTag]);
    
    if (insertError) {
      console.error('RLS test insert failed:', insertError);
      
      // Check if it's an RLS error
      if (insertError.message.includes('policy') || insertError.message.includes('permission')) {
        return NextResponse.json({
          status: 'rls_error',
          error: insertError.message,
          fix: [
            "RLS (Row Level Security) is preventing inserts. To fix this:",
            "1. Go to your Supabase dashboard",
            "2. Select 'Authentication' > 'Policies' from the left sidebar",
            "3. Find your 'tags' table",
            "4. Either disable RLS by toggling it off (less secure, only for development)",
            "5. Or add a policy to allow inserts with this template:",
            `CREATE POLICY "Enable all operations for authenticated and anon users" ON "public"."tags"
             FOR ALL USING (true) WITH CHECK (true);`
          ]
        });
      }
      
      return NextResponse.json({
        status: 'error',
        error: insertError.message,
        fix: ["Please check database connection and schema"]
      });
    }
    
    // Try to get the tag back and then delete it
    const { data: verifyData, error: verifyError } = await supabase
      .from('tags')
      .select('*')
      .eq('wallet_address', testTag.wallet_address)
      .single();
    
    // Clean up the test tag
    await supabase
      .from('tags')
      .delete()
      .eq('wallet_address', testTag.wallet_address);
    
    return NextResponse.json({
      status: 'ok',
      message: 'RLS test passed! You can insert into the tags table.',
      insertResult: insertData || 'Insert succeeded',
      verifyResult: verifyData || 'Not found',
      supabaseConfig: {
        hasUrl: supabaseConfig.hasUrl,
        hasKey: supabaseConfig.hasKey
      }
    });
  } catch (error) {
    console.error('RLS check error:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message
    }, { status: 500 });
  }
} 