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
  const johnId = 'cd65858e-5c24-44ef-896e-9b7bca9b421f'
  console.log(`--- Checking requests for John Doe (ID: ${johnId}) ---`)
  const { data: requests, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', johnId)
  
  if (error) {
    console.error(error)
  } else {
    console.log(`Found ${requests.length} requests for John Doe.`)
    requests.forEach(r => console.log(`- Request: ${r.type}, Status: ${r.status}, Start: ${r.start_date}`))
  }

  console.log('\n--- Checking all records in leave_requests ---')
  const { data: allReqs } = await supabase.from('leave_requests').select('user_id, type, status')
  allReqs?.forEach(r => console.log(`- User: ${r.user_id}, Type: ${r.type}`))
}

check()
