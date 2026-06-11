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

async function findTables() {
  console.log('--- Searching for ALL tables ---')
  // We can use a trick: try to query common tables or use rpc if available
  // But a better way is to use a raw query if we have the postgres connection
  // Since we don't have a direct postgres client easily, let's try common ones
  const commonTables = [
    'User', 'profiles', 'departments', 'holidays', 'leave_balances', 
    'leave_requests', 'leave_ledger_entries', 'system_configs', 'audit_logs',
    'negative_leave_trackings', 'comp_off_work_entries', 'leave_balance_adjustments',
    'system_date_overrides', 'CarryForwardHistory', 'LeaveYearClosure',
    'SeedUser', 'SeedDepartment', 'SeedLeaveBalance', 'SeedHoliday', 'SeedSystemConfig'
  ]

  for (const table of commonTables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (!error) {
      console.log(`Table "${table}": ${count} records`)
    }
  }
}

findTables()
