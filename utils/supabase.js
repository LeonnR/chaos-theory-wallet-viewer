import { createClient } from '@supabase/supabase-js'

// Get Supabase URL and anon key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Data persistence will not work.')
} else {
  console.log(`Supabase URL is configured: ${supabaseUrl.substring(0, 8)}...`)
}

if (!supabaseAnonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Data persistence will not work.')
} else {
  console.log(`Supabase Anon Key is configured: ${supabaseAnonKey.substring(0, 5)}...`)
}

// Create a singleton Supabase client
const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co', // Use a placeholder URL if not provided
  supabaseAnonKey || 'missing-key' // Use a placeholder key if not provided
)

// Export the URL and key as well for debugging
export const supabaseConfig = {
  url: supabaseUrl,
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey
}

export default supabase 