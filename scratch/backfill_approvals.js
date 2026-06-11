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

async function backfill() {
  console.log('--- Backfilling Approval Info for Legacy Data ---')
  
  const adminId = 'bac371b3-bfb0-44ad-bc46-48aa21d4045b' // Priya Sharma
  const managerId = '9b7fd531-843b-4184-9997-dbcdf49e54b6' // Rahul Verma

  // 1. Backfill HR_APPROVED
  console.log('Updating HR_APPROVED requests...')
  const { error: hrError } = await supabase
    .from('leave_requests')
    .update({ 
      approved_by_id: adminId, 
      approved_at: new Date('2026-06-09T13:21:18Z').toISOString() 
    })
    .eq('status', 'HR_APPROVED')
    .is('approved_by_id', null)

  if (hrError) console.error(hrError)

  // 2. Backfill L1_APPROVED
  console.log('Updating L1_APPROVED requests...')
  const { error: l1Error } = await supabase
    .from('leave_requests')
    .update({ 
      approved_by_id: managerId, 
      approved_at: new Date('2026-06-09T12:00:00Z').toISOString() 
    })
    .eq('status', 'L1_APPROVED')
    .is('approved_by_id', null)

  if (l1Error) console.error(l1Error)

  console.log('--- Done! Refresh the Leave Register. ---')
}

backfill()
