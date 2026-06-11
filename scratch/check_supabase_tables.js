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

async function checkProfiles() {
  console.log('--- Checking Supabase "profiles" table ---')
  const { data, error } = await supabase.from('profiles').select('*')
  if (error) {
    console.error('Error fetching profiles:', error.message)
    return
  }
  console.log(`Found ${data.length} profiles.`)
  data.forEach(p => console.log(`- ${p.email} (ID: ${p.id})`))

  console.log('\n--- Checking Supabase "User" table ---')
  const { data: users, error: userError } = await supabase.from('User').select('*')
  if (userError) {
    console.warn('Error fetching User table (might not exist):', userError.message)
  } else {
    console.log(`Found ${users.length} records in "User" table.`)
    users.forEach(u => console.log(`- ${u.email} (ID: ${u.id})`))
  }
}

checkProfiles()
