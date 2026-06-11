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

async function debug() {
  console.log('--- Debugging Team Join ---')
  const { data: users, error } = await supabase
    .from('profiles')
    .select('name, email, leave_balances(*)')
    .neq('role', 'ADMIN')
    .limit(3)
  
  if (error) {
    console.error(error)
  } else {
    users.forEach(u => {
      console.log(`User: ${u.name} (${u.email})`)
      console.log(`Balances Type: ${typeof u.leave_balances}`)
      console.log(`Balances IsArray: ${Array.isArray(u.leave_balances)}`)
      console.log(`Balances Data:`, JSON.stringify(u.leave_balances, null, 2))
      console.log('---')
    })
  }
}

debug()
