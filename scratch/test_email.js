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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function testEmail() {
  const email = `admin-test-${Date.now()}@company.com`
  console.log(`Testing creation with: ${email}`)
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: 'Password123!',
    email_confirm: true
  })
  
  if (error) {
    console.error('Error:', error.message)
  } else {
    console.log('Success! ID:', data.user.id)
  }
}

testEmail()
