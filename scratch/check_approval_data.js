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
  console.log('--- Checking Legacy LeaveRequest Approval Info ---')
  const { data: legacy } = await supabase.from('LeaveRequest').select('id, status, approvedById, approvedAt')
  legacy?.forEach(r => {
    console.log(`Legacy ID: ${r.id}, Status: ${r.status}, Approver: ${r.approvedById}, At: ${r.approvedAt}`)
  })

  console.log('\n--- Checking New leave_requests Approval Info ---')
  const { data: newReqs } = await supabase.from('leave_requests').select('id, status, approved_by_id, approved_at')
  newReqs?.forEach(r => {
    console.log(`New ID: ${r.id}, Status: ${r.status}, Approver: ${r.approved_by_id}, At: ${r.approved_at}`)
  })
}

check()
