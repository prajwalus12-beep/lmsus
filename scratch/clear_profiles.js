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

async function clearProfiles() {
  console.log('--- Clearing orphaned "profiles" ---')
  const { error } = await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) {
    console.error('Error clearing profiles:', error.message)
    return
  }
  console.log('Successfully cleared profiles table.')
}

clearProfiles()
