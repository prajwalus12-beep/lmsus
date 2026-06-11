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
  console.log('--- Checking for Alice Wong ---')
  const { data: users, error: userError } = await supabase
    .from('User')
    .select('*')
    .ilike('name', '%Alice%')
  
  if (userError) {
    console.error('Error fetching User:', userError.message)
  } else {
    console.log('Users found:', users)
    if (users.length > 0) {
      const alice = users[0]
      console.log(`\nChecking balances for Alice (ID: ${alice.id})...`)
      
      const { data: balances, error: balanceError } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', alice.id)
      
      if (balanceError) {
        console.error('Error fetching leave_balances:', balanceError.message)
      } else {
        console.log('Balances found in leave_balances:', balances)
      }

      const { data: prismaBalances, error: prismaBalanceError } = await supabase
        .from('LeaveBalance')
        .select('*')
        .eq('userId', alice.id)
      
      if (prismaBalanceError) {
        console.warn('Error fetching LeaveBalance (Prisma name):', prismaBalanceError.message)
      } else {
        console.log('Balances found in LeaveBalance:', prismaBalances)
      }
    }
  }

  console.log('\n--- Checking for John Doe ---')
  const { data: johns, error: johnError } = await supabase
    .from('User')
    .select('*')
    .ilike('name', '%John%')
  
  if (johnError) {
    console.error('Error fetching User:', johnError.message)
  } else {
    console.log('Users found:', johns)
    if (johns.length > 0) {
      const john = johns[0]
      console.log(`\nChecking balances for John (ID: ${john.id})...`)
      
      const { data: balances, error: balanceError } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', john.id)
      
      if (balanceError) {
        console.error('Error fetching leave_balances:', balanceError.message)
      } else {
        console.log('Balances found in leave_balances:', balances)
      }
    }
  }
}

check()
