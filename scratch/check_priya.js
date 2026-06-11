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
const supabaseKey = env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPriya() {
  const { data: user } = await supabase.from('profiles').select('*').eq('email', 'admin@company.com').single()
  if (!user) {
    console.log("Priya Sharma not found")
    return
  }
  console.log(`User: ${user.name}, ID: ${user.id}`)

  const { data: entries } = await supabase.from('leave_ledger_entries').select('*').eq('user_id', user.id).order('date', { ascending: true })
  console.log(`Entries found: ${entries.length}`)
  entries.forEach(e => {
    console.log(`- Date: ${e.date}, Type: ${e.type}, Desc: ${e.description}`)
  })
}

checkPriya()
