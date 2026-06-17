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

async function checkProfiles() {
  console.log('=== Check profiles table ===\n')
  
  // Check profiles table
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .limit(10)
  
  if (profilesError) {
    console.log('Error querying profiles:', profilesError.message)
  } else {
    console.log(`Profiles found: ${profiles?.length || 0}`)
    profiles?.forEach(p => console.log(`  - ${p.id}: ${p.email || p.full_name || 'no name'}`))
  }

  // Check if profiles table has a trigger by looking at the schema
  console.log('\n--- Trying to create a user via admin SDK ---\n')
  
  const { data, error } = await supabase.auth.admin.createUser({
    email: `test_${Date.now()}@yopmail.com`,
    password: 'Test123!',
    email_confirm: true
  })
  
  if (error) {
    console.log('Error creating user:', error.message)
    console.log('Full error:', JSON.stringify(error, null, 2))
  } else {
    console.log('User created:', data.user?.email, data.user?.id)
    
    // Now check if a profile was auto-created
    const { data: newProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()
    
    if (newProfile) {
      console.log('Profile auto-created:', JSON.stringify(newProfile, null, 2))
    } else {
      console.log('No profile was auto-created for this user')
    }
  }
}

checkProfiles().catch(console.error)