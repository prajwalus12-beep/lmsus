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
  console.log('--- Checking all records in "leave_balances" ---')
  const { data, error } = await supabase.from('leave_balances').select('*')
  if (error) {
    console.error('Error:', error.message)
  } else {
    console.log(`Found ${data.length} records.`)
    data.forEach(r => console.log(r))
  }

  console.log('\n--- Checking all records in "LeaveBalance" (Prisma) ---')
  const { data: prismaData, error: prismaError } = await supabase.from('LeaveBalance').select('*')
  if (prismaError) {
    console.warn('Error:', prismaError.message)
  } else {
    console.log(`Found ${prismaData.length} records.`)
    prismaData.forEach(r => console.log(r))
  }
}

check()
