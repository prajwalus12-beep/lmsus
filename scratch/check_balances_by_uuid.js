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

async function check() {
  const aliceId = '5ac538fc-42a7-414d-808c-e62bd98964db'
  console.log(`--- Checking balances for Alice Wong (ID: ${aliceId}) ---`)
  
  const { data: balances, error } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('user_id', aliceId)
  
  if (error) {
    console.error('Error:', error.message)
  } else {
    console.log('Balances:', balances)
  }

  const johnId = 'cd65858e-5c24-44ef-896e-9b7bca9b421f'
  console.log(`\n--- Checking balances for John Doe (ID: ${johnId}) ---`)
  const { data: johnBalances, error: johnError } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('user_id', johnId)
  
  if (johnError) {
    console.error('Error:', johnError.message)
  } else {
    console.log('Balances:', johnBalances)
  }
}

check()
