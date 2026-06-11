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
const supabaseKey = env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function listAllApprovedLeaves() {
  const { data: requests } = await supabase
    .from('leave_requests')
    .select('*, profiles(name)')
    .in('status', ['HR_APPROVED', 'L1_APPROVED'])
    .order('start_date', { ascending: true })

  console.log(`Found ${requests?.length || 0} approved leaves:`)
  requests?.forEach(r => {
    console.log(`- ${r.profiles?.name}: ${r.type} from ${r.start_date} to ${r.end_date} (ID: ${r.user_id})`)
  })
}

listAllApprovedLeaves()
