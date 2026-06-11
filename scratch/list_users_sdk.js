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
    if (key && value) env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '')
  })
  return env
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function listAllUsers() {
  console.log('=== List all auth users using admin SDK ===\n')
  
  // Try with pagination
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 100
  })
  
  if (error) {
    console.log('Error:', error.message)
    console.log('Full error:', JSON.stringify(error, null, 2))
    return
  }
  
  console.log(`Total users: ${data.total || 'unknown'}`)
  console.log(`Users in response: ${data.users?.length || 0}`)
  
  if (data.users && data.users.length > 0) {
    data.users.forEach(u => {
      console.log(`  - ${u.email} (${u.id})`)
      console.log(`    Created: ${u.created_at}`)
      console.log(`    Confirmed: ${!!u.email_confirmed_at}`)
      console.log(`    Identities: ${u.identities?.length || 0}`)
    })
  } else {
    console.log('No users found')
  }
}

listAllUsers().catch(console.error)