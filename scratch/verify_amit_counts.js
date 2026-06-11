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
const supabaseKey = env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyAmitData() {
  const { data: user } = await supabase.from('profiles').select('*').ilike('name', '%Amit%').single()
  if (!user) {
    console.log("Amit Kumar not found")
    return
  }
  console.log(`User: ${user.name}, ID: ${user.id}`)

  const { data: balance } = await supabase.from('leave_balances').select('*').eq('user_id', user.id).single()
  console.log("Balance Table State:", JSON.stringify(balance, null, 2))

  const { data: requests } = await supabase.from('leave_requests').select('*').eq('user_id', user.id).eq('status', 'HR_APPROVED')
  console.log(`Approved Requests: ${requests.length}`)
  requests.forEach(r => {
    console.log(`- ${r.type} from ${r.start_date} to ${r.end_date} (Status: ${r.status})`)
  })

  const { data: adjustments } = await supabase.from('leave_balance_adjustments').select('*').eq('user_id', user.id)
  console.log(`Adjustments: ${adjustments.length}`)
  adjustments.forEach(a => {
    console.log(`- ${a.leave_type} ${a.amount} (${a.adjustment_type}): ${a.reason}`)
  })

  const { data: ledger } = await supabase.from('leave_ledger_entries').select('*').eq('user_id', user.id).order('date', { ascending: true })
  console.log(`Ledger Entries: ${ledger.length}`)
  ledger.forEach(l => {
    console.log(`- ${l.date} | ${l.type} | ${l.description} | PL Bal: ${l.pl_balance} | CL Bal: ${l.cl_balance}`)
  })
}

verifyAmitData()
