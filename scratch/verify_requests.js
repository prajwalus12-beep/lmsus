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

async function check() {
  const { data, count, error } = await supabase
    .from('leave_requests')
    .select('*', { count: 'exact' })
  
  if (error) {
    console.error('Error:', error.message)
  } else {
    console.log('Total Leave Requests in Supabase:', count)
    if (data && data.length > 0) {
      console.log('Sample request user_id:', data[0].user_id)
      console.log('Sample request status:', data[0].status)
    }
  }
}

check()
