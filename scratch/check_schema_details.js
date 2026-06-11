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

async function checkSchema() {
  console.log('--- Checking profiles columns ---')
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*').limit(1)
  if (pError) console.error(pError)
  else console.log('Profiles sample:', profiles[0])

  console.log('\n--- Checking leave_balances columns ---')
  const { data: balances, error: bError } = await supabase.from('leave_balances').select('*').limit(1)
  if (bError) console.error(bError)
  else if (balances.length === 0) console.log('leave_balances is EMPTY')
  else console.log('leave_balances sample:', balances[0])

  console.log('\n--- Checking LeaveBalance (Prisma) columns ---')
  const { data: pBalances, error: pbError } = await supabase.from('LeaveBalance').select('*').limit(1)
  if (pbError) console.error(pbError)
  else console.log('LeaveBalance sample:', pBalances[0])
}

checkSchema()
