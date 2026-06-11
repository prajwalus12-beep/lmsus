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

async function listAuthUsers() {
  console.log('=== Listing all auth users ===\n')

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'GET',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  })

  const data = await response.json()
  console.log('Status:', response.status)
  
  if (response.ok) {
    if (data.users && data.users.length > 0) {
      console.log(`Found ${data.users.length} users:\n`)
      data.users.forEach(u => {
        console.log(`  - ${u.email}`)
        console.log(`    ID: ${u.id}`)
        console.log(`    Confirmed: ${u.email_confirmed_at ? 'Yes' : 'No'}`)
        console.log(`    Created: ${u.created_at}`)
        console.log()
      })
    } else {
      console.log('No users found in auth.users')
    }
  } else {
    console.log('Error:', JSON.stringify(data, null, 2))
  }
}

listAuthUsers().catch(console.error)