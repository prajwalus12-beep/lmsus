const { createClient } = require('@supabase/supabase-client')
const dotenv = require('dotenv')
dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPriyaLedger() {
  const { data: user } = await supabase.from('profiles').select('*').eq('email', 'admin@company.com').single()
  if (!user) {
    console.log("Priya Sharma (admin@company.com) not found")
    return
  }

  console.log(`Checking ledger for ${user.name} (${user.id})`)

  const { data: balances } = await supabase.from('leave_balances').select('*').eq('user_id', user.id)
  console.log("Balances:", balances)

  const { data: entries } = await supabase.from('leave_ledger_entries').select('*').eq('user_id', user.id).order('date', { ascending: true })
  console.log(`Found ${entries.length} ledger entries`)
  if (entries.length > 0) {
    console.log("First entry:", entries[0])
    console.log("Last entry:", entries[entries.length - 1])
  }

  const { data: requests } = await supabase.from('leave_requests').select('*').eq('user_id', user.id).eq('status', 'HR_APPROVED')
  console.log(`Found ${requests.length} approved leave requests`)
}

checkPriyaLedger()
