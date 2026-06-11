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

async function findAndDeleteUsers() {
  console.log('=== Finding and deleting existing auth users ===\n')
  
  const emails = [
    'admin@company.com',
    'manager@company.com', 
    'john@company.com',
    'jane@company.com',
    'amit@company.com',
    'alice.wong@company.com',
    'diana.prince@company.com'
  ]

  // First, try to get all users with pagination
  console.log('Fetching all auth users (with pagination)...')
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=100`, {
    method: 'GET',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  })

  const data = await response.json()
  console.log('Status:', response.status)
  
  if (response.ok) {
    console.log(`Total users returned: ${data.users?.length || 0}`)
    if (data.users && data.users.length > 0) {
      data.users.forEach(u => {
        console.log(`  - ${u.email} (${u.id}) [confirmed: ${!!u.email_confirmed_at}]`)
      })
    }
  } else {
    console.log('Error:', JSON.stringify(data, null, 2))
  }

  // Try to get users by email using the admin API
  console.log('\nTrying to find specific users by email...')
  for (const email of emails) {
    const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    })
    const result = await resp.json()
    if (result.users && result.users.length > 0) {
      console.log(`  Found: ${email} -> ${result.users[0].id}`)
    } else {
      console.log(`  Not found via API: ${email}`)
    }
  }
}

findAndDeleteUsers().catch(console.error)