import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ulwoyxlnmtfnbfpfujtq.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || ''

if (!supabaseServiceKey) {
  console.warn('SUPABASE_SERVICE_KEY is missing. Admin operations will fail.')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
