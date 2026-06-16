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
    if (key && value) env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '')
  })
  return env
}

const env = loadEnv()
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

async function checkBalances() {
  const { data, error } = await supabase.from('leave_balances').select('*').limit(1)
  if (error) console.error(error)
  else console.log('Leave Balance columns:', data.length > 0 ? Object.keys(data[0]) : 'No data')
}

checkBalances()