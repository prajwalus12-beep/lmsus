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
  console.log('--- Checking leave_requests data ---')
  const { data: requests, error } = await supabase.from('leave_requests').select('*, profiles(name)')
  if (error) {
    console.error(error)
  } else {
    console.log(`Found ${requests.length} requests.`)
    requests.slice(0, 3).forEach(r => {
        console.log(`- Request ID: ${r.id}, User: ${r.profiles?.name}, Status: ${r.status}`)
    })
  }

  console.log('\n--- Checking comp_off_work_entries data ---')
  const { data: compOffs, error: coError } = await supabase.from('comp_off_work_entries').select('*, profiles(name)')
  if (coError) {
    console.error(coError)
  } else {
    console.log(`Found ${compOffs.length} comp-off entries.`)
  }
}

check()
