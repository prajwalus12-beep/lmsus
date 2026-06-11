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

async function checkAllData() {
  const tables = [
    'departments',
    'profiles',
    'leave_balances',
    'leave_requests',
    'leave_ledger_entries',
    'negative_leave_trackings'
  ]

  console.log('=== Comprehensive DB Check ===\n')

  for (const table of tables) {
    const { data, count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .limit(5)

    if (error) {
      console.log(`Table "${table}": ERROR - ${error.message}`)
    } else {
      console.log(`Table "${table}": ${count} records found.`)
      if (data && data.length > 0) {
        console.log(`  Sample:`, JSON.stringify(data[0], null, 2))
      }
      console.log('------------------------------')
    }
  }
}

checkAllData()
