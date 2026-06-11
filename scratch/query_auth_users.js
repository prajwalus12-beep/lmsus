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

async function queryAuthUsers() {
  console.log('=== Querying auth.users table directly via REST API ===\n')
  
  // Try to access auth.users via the REST API (requires service role key)
  const response = await fetch(`${supabaseUrl}/rest/v1/auth/users`, {
    method: 'GET',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Accept': 'application/json'
    }
  })

  console.log('Status:', response.status)
  const text = await response.text()
  console.log('Response:', text.substring(0, 2000))
  
  // Also try the /rest/v1/ endpoint with auth schema
  console.log('\n--- Trying /rest/v1/ with Accept header ---')
  const resp2 = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'GET',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Accept': 'application/json',
      'Accept-Profile': 'auth'
    }
  })
  console.log('Status:', resp2.status)
  const text2 = await resp2.text()
  console.log('Response:', text2.substring(0, 2000))
}

queryAuthUsers().catch(console.error)