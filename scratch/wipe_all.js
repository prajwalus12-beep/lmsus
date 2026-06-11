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

async function wipeDatabase() {
  console.log('--- WIPING APPLICATION DATA ---')
  
  // Tables to clear in order (dependents first)
  const tables = [
    'audit_logs',
    'leave_balance_adjustments',
    'leave_ledger_entries',
    'leave_requests',
    'comp_off_work_entries',
    'negative_leave_trackings',
    'leave_balances',
    'User',
    'profiles',
    'departments',
    'holidays',
    'system_configs'
  ]

  for (const table of tables) {
    console.log(`Clearing ${table}...`)
    const { error } = await supabase.from(table).delete().neq('id', 'placeholder-id')
    if (error) {
      console.warn(`  - Note: Could not clear ${table}: ${error.message}`)
    }
  }

  console.log('\n--- CLEARING AUTH USERS ---')
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (!listError) {
    for (const user of users) {
      console.log(`Deleting Auth User: ${user.email}...`)
      await supabase.auth.admin.deleteUser(user.id)
    }
  }

  console.log('Wipe complete.')
}

wipeDatabase()
