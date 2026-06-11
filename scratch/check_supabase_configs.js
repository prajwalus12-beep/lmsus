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

async function checkConfigs() {
  console.log('--- Checking system_configs in Supabase ---')
  const { data: configs, error } = await supabase.from('system_configs').select('*')
  if (error) {
    console.error('Error:', error.message)
  } else {
    console.log(`Found ${configs.length} configs:`)
    configs.forEach(c => console.log(`- ${c.key}: ${c.value}`))
    
    if (!configs.find(c => c.key === 'MAX_NEGATIVE_LEAVE')) {
      console.log('\nMAX_NEGATIVE_LEAVE IS MISSING! Adding it now...')
      await supabase.from('system_configs').insert({
        key: 'MAX_NEGATIVE_LEAVE',
        value: '-5',
        description: 'Maximum allowed negative leave balance'
      })
      console.log('Added MAX_NEGATIVE_LEAVE.')
    }
  }
}

checkConfigs()
