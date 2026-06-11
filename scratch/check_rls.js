const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return {}
  const content = fs.readFileSync(envPath, 'utf8')
  const env = {}
  content.split('\n').forEach(line => {
    const [key, ...value] = line.split('=')
    if (key && value) {
      env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '')
    }
  })
  return env
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkRLS() {
  console.log('--- Checking RLS Policies for leave_requests ---')
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'leave_requests' })
  
  if (error) {
    console.warn('RPC get_policies failed (might not exist):', error.message)
    // Fallback: Try to query pg_policies via raw SQL if possible, 
    // but Supabase JS doesn't support raw SQL easily unless we use a custom function.
    // Let's try to just describe the table or see if RLS is enabled.
    
    // Actually, I can try to run a query that might reveal RLS status.
    console.log('Testing INSERT without specific user context...')
    const { error: insertError } = await supabase.from('leave_requests').insert({
       user_id: '00000000-0000-0000-0000-000000000000',
       type: 'TEST',
       reason: 'Testing RLS',
       start_date: new Date().toISOString(),
       end_date: new Date().toISOString(),
       year: 2026,
       status: 'PENDING'
    })
    
    if (insertError) {
      console.log('Insert failed (expected if RLS is on):', insertError.message)
    } else {
      console.log('Insert SUCCEEDED (RLS might be OFF or service key bypassed it)')
      // Delete the test row
      await supabase.from('leave_requests').delete().eq('type', 'TEST')
    }
  } else {
    console.log('Policies:', data)
  }
}

checkRLS()
