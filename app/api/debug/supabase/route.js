import { NextResponse } from 'next/server';
import supabase, { supabaseConfig } from '@/utils/supabase';

export async function GET() {
  try {
    // Attempt to connect to Supabase and check tags table
    const { data: tableData, error: tableError } = await supabase
      .from('tags')
      .select('count')
      .limit(1);
    
    // Check if the required environment variables are set
    const hasRequiredEnvVars = supabaseConfig.hasUrl && supabaseConfig.hasKey;
    
    // Get a list of tables from Supabase for debugging
    let tables = [];
    let tablesError = null;
    
    try {
      // This requires admin access, so may not work with anon key
      const { data, error } = await supabase.rpc('get_tables');
      if (!error) {
        tables = data;
      } else {
        tablesError = error.message;
      }
    } catch (e) {
      tablesError = e.message;
    }
    
    return NextResponse.json({
      status: tableError ? 'error' : 'ok',
      connection: {
        url: supabaseConfig.url ? `${supabaseConfig.url.substring(0, 8)}...` : 'Missing URL',
        hasUrl: supabaseConfig.hasUrl,
        hasKey: supabaseConfig.hasKey,
        isConfigured: hasRequiredEnvVars
      },
      tagsTable: {
        exists: !tableError,
        error: tableError ? tableError.message : null,
        data: tableData || null
      },
      tables: {
        list: tables,
        error: tablesError
      },
      test: {
        now: new Date().toISOString(),
        environment: process.env.NODE_ENV
      }
    });
  } catch (error) {
    console.error('Supabase debug API error:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 