import { createClient } from '@supabase/supabase-js'

// Get Supabase URL and anon key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Data persistence will not work.')
}

// Create a singleton Supabase client
const supabase = createClient(
  supabaseUrl || 'https://your-project-url.supabase.co',
  supabaseAnonKey || 'your-anon-key'
)

export default supabase 