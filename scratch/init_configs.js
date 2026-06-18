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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

async function main() {
  const { data, error } = await supabase
    .from('system_configs')
    .select('*')
    .eq('key', 'ENABLE_EMAIL_NOTIFICATIONS')

  if (error) {
    console.error('Error fetching config:', error)
    return
  }

  if (data.length === 0) {
    const { error: iError } = await supabase
      .from('system_configs')
      .insert({
        key: 'ENABLE_EMAIL_NOTIFICATIONS',
        value: 'true',
        description: 'Enable/Disable all outgoing email notifications'
      })
    
    if (iError) {
      console.error('Error inserting config:', iError)
    } else {
      console.log('Successfully added ENABLE_EMAIL_NOTIFICATIONS config.')
    }
  } else {
    console.log('ENABLE_EMAIL_NOTIFICATIONS config already exists:', data[0])
  }
}

main()
