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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY

async function createUserViaRest() {
  console.log('=== Creating user via REST API ===\n')

  // Try creating a user via the auth admin REST API
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({
      email: 'admin@company.com',
      password: 'Unique@123',
      email_confirm: true,
      user_metadata: { name: 'Priya Sharma', role: 'ADMIN' }
    })
  })

  const data = await response.json()
  console.log('Status:', response.status)
  console.log('Response:', JSON.stringify(data, null, 2))
  
  if (response.ok) {
    console.log('\n✅ User created successfully!')
  } else {
    console.log('\n❌ Failed to create user')
    console.log('Error details:', data.msg || data.error || JSON.stringify(data))
  }
}

createUserViaRest().catch(console.error)