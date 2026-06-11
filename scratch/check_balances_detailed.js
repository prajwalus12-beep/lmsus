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

async function checkLegacyBalances() {
  console.log('--- Checking Legacy LeaveBalance ---')
  const { data: legacy, error } = await supabase.from('LeaveBalance').select('*')
  if (error) {
    console.error(error)
  } else {
    legacy.forEach(b => {
      console.log(`Legacy User ${b.userId}: PL ${b.pl}, CL ${b.cl}, PL_Used ${b.plUsed}, CL_Used ${b.clUsed}`)
    })
  }

  console.log('\n--- Checking New leave_balances ---')
  const { data: newB, error: newError } = await supabase.from('leave_balances').select('*, profiles(name)')
  if (newError) {
    console.error(newError)
  } else {
    newB.forEach(b => {
      console.log(`New User ${b.profiles?.name}: PL ${b.pl}, CL ${b.cl}, PL_Used ${b.pl_used}, CL_Used ${b.cl_used}`)
    })
  }
}

checkLegacyBalances()
