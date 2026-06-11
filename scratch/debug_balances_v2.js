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

async function debug() {
  console.log('--- 1. Checking Profiles ---')
  const { data: profiles } = await supabase.from('profiles').select('id, email, name')
  console.log(`Found ${profiles?.length || 0} profiles.`)
  profiles?.forEach(p => console.log(`- ${p.email} [ID: ${p.id}]`))

  console.log('\n--- 2. Checking Leave Balances (Service Role) ---')
  const { data: balances, error: bError } = await supabase.from('leave_balances').select('*')
  if (bError) {
    console.error('Error fetching balances:', bError.message)
  } else {
    console.log(`Found ${balances?.length || 0} balance records.`)
    balances?.forEach(b => console.log(`- UserID: ${b.user_id}, PL: ${b.pl}, CL: ${b.cl}`))
  }

  const alice = profiles?.find(p => p.email === 'alice.wong@company.com')
  if (alice) {
    console.log(`\n--- 3. Checking Alice Wong Specifics (ID: ${alice.id}) ---`)
    const { data: aliceBal } = await supabase.from('leave_balances').select('*').eq('user_id', alice.id)
    console.log('Alice Balances:', aliceBal)
    
    if (aliceBal?.length === 0) {
      console.log('ALICE HAS NO BALANCE RECORD! Attempting to create one now...')
      const { data: inserted, error: iError } = await supabase.from('leave_balances').insert({
        user_id: alice.id,
        year: 2026,
        pl: 12,
        cl: 7,
        sl: 7,
        comp: 1,
        opening_pl: 12,
        opening_cl: 7
      }).select()
      
      if (iError) console.error('Failed to create balance:', iError.message)
      else console.log('Successfully created balance for Alice:', inserted)
    }
  } else {
    console.log('\nAlice Wong not found in profiles!')
  }
}

debug()
