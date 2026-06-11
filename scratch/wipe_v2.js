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

async function clearTable(name) {
  console.log(`Clearing ${name}...`)
  // To clear a table with UUID or CUID, we just use a delete without filter if possible, 
  // but Supabase requires a filter. We use a filter that matches all.
  const { data, error } = await supabase.from(name).select('id')
  if (error) {
    console.warn(`  - Could not list ${name}: ${error.message}`)
    return
  }
  
  if (data.length === 0) {
    console.log(`  - ${name} is already empty.`)
    return
  }

  const ids = data.map(i => i.id)
  const { error: delError } = await supabase.from(name).delete().in('id', ids)
  if (delError) {
    console.error(`  - FAILED to clear ${name}: ${delError.message}`)
  } else {
    console.log(`  - Successfully cleared ${data.length} records from ${name}.`)
  }
}

async function wipeAll() {
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
    await clearTable(table)
  }

  console.log('\n--- CLEARING AUTH USERS ---')
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (!listError) {
    for (const user of users) {
      console.log(`Deleting Auth User: ${user.email}...`)
      await supabase.auth.admin.deleteUser(user.id)
    }
  }
}

wipeAll()
