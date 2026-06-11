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

async function migrateAdjustments() {
  console.log('--- Migrating Adjustments ---')
  const { data: legacyUsers } = await supabase.from('User').select('id, email')
  const { data: newProfiles } = await supabase.from('profiles').select('id, email')
  
  const emailToUuid = {}
  newProfiles.forEach(p => emailToUuid[p.email] = p.id)
  
  const legacyIdToUuid = {}
  legacyUsers.forEach(u => legacyIdToUuid[u.id] = emailToUuid[u.email])

  const { data: adjustments } = await supabase.from('LeaveBalanceAdjustment').select('*')
  console.log(`Found ${adjustments?.length || 0} legacy adjustments.`)

  if (adjustments && adjustments.length > 0) {
    const newAdjustments = adjustments.map(a => ({
      user_id: legacyIdToUuid[a.userId],
      leave_type: a.leaveType,
      amount: a.amount,
      adjustment_type: a.adjustmentType,
      reason: a.reason,
      effective_year: a.effectiveYear,
      entered_by: legacyIdToUuid[a.enteredBy] || a.enteredBy, // Might be system or admin UUID
      entered_by_name: a.enteredByName,
      remarks: a.remarks,
      created_at: a.createdAt
    })).filter(a => a.user_id)

    await supabase.from('leave_balance_adjustments').delete().neq('id', '0')
    const { error } = await supabase.from('leave_balance_adjustments').insert(newAdjustments)
    if (error) console.error('  Error:', error.message)
    else console.log(`  Migrated ${newAdjustments.length} adjustments.`)
  }
}

migrateAdjustments()
