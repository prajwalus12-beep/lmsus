import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ulwoyxlnmtfnbfpfujtq.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-anon-key'

if (supabaseAnonKey === 'your-anon-key-here' || supabaseAnonKey === 'dummy-anon-key') {
  console.warn('Supabase Anon Key is missing or using a placeholder. Login and other features will fail.')
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
