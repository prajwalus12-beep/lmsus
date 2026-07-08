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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "https://ulwoyxlnmtfnbfpfujtq.supabase.co"
const supabaseKey = env.SUPABASE_SERVICE_KEY || ""

const supabase = createClient(supabaseUrl, supabaseKey)
