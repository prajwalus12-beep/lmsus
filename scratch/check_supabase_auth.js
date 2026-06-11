const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Simple .env parser
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
  console.log('Current env keys:', Object.keys(env))
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkAuthUsers() {
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
  
  if (error) {
    console.error('Error listing users:', error.message)
    return
  }

  console.log(`Found ${users.length} users in Supabase Auth:`)
  users.forEach(u => {
    console.log(`- Email: ${u.email}, ID: ${u.id}, Created At: ${u.created_at}`)
  })
}

checkAuthUsers()
