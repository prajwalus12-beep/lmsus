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

async function testCreateNewEmail() {
  console.log('=== Test: Create user with a completely new email ===\n')
  
  const testEmail = `testuser_${Date.now()}@example.com`
  console.log(`Trying to create: ${testEmail}\n`)

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({
      email: testEmail,
      password: 'Test123!',
      email_confirm: true
    })
  })

  const data = await response.json()
  console.log('Status:', response.status)
  console.log('Response:', JSON.stringify(data, null, 2))
  
  if (response.ok) {
    console.log('\n✅ New email user created successfully!')
    console.log('This means the issue is specific to existing emails.')
  } else {
    console.log('\n❌ Failed even with new email')
    console.log('This means there is a general database issue.')
  }
}

testCreateNewEmail().catch(console.error)