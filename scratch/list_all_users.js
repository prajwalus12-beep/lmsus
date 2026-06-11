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
  console.log('--- Listing All Users in "User" table ---')
  const { data: users, error: userError } = await supabase
    .from('User')
    .select('id, name, email')
  
  if (userError) {
    console.error('Error fetching User:', userError.message)
  } else {
    console.log(`Found ${users.length} users:`)
    users.forEach(u => console.log(`- ${u.name} (${u.email}) [ID: ${u.id}]`))
  }
}

check()
