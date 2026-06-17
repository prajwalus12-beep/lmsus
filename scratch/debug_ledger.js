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

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPriyaLedger() {
  const targetId = '16d91530-8c2d-4b2d-aefd-bf4e790e3037'
  console.log(`Checking for User (ID: ${targetId})`)
  
  const { data: profile } = await supabase.from('profiles').select('*, leave_balances(*)').eq('id', targetId).single()
  console.log('Profile with balances:', JSON.stringify(profile, null, 2))

  const { data: ledger } = await supabase.from('leave_ledger_entries').select('*').eq('user_id', priyaId)
  console.log('Ledger entries count:', ledger?.length || 0)

  const { data: allNonAdmins } = await supabase.from('profiles')
    .select('id, name')
    .in('status', ['ACTIVE', 'NOTICE_PERIOD'])
    .neq('role', 'ADMIN')
  console.log('Non-Admin users found:', allNonAdmins?.length || 0)
  allNonAdmins?.forEach(u => console.log(` - ${u.name} (${u.id})`))
}

checkPriyaLedger()
