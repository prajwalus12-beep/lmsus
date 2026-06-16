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
    if (key && value) env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '')
  })
  return env
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function checkLedgerSchema() {
  console.log('=== Checking Leave Ledger Entries Schema ===\n')

  const { data: columns, error: colError } = await supabaseAdmin
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', 'leave_ledger_entries')
    .eq('table_schema', 'public')
  
  if (colError) {
    console.log(`  Error: ${colError.message}`)
  } else {
    columns?.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`))
  }
}

checkLedgerSchema().catch(console.error)