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

async function migrateData() {
  console.log('=== DATA MIGRATION REPAIR: Including Approval Info ===\n')

  // 1. Get mappings
  const { data: legacyUsers } = await supabase.from('User').select('*')
  const { data: newProfiles } = await supabase.from('profiles').select('*')

  const emailToUuid = {}
  newProfiles.forEach(p => emailToUuid[p.email] = p.id)

  const legacyIdToUuid = {}
  legacyUsers.forEach(u => legacyIdToUuid[u.id] = emailToUuid[u.email])

  // 2. Migrate Leave Requests
  console.log('Re-migrating Leave Requests...')
  const { data: legacyRequests } = await supabase.from('LeaveRequest').select('*')
  const newRequests = legacyRequests.map(r => ({
    user_id: legacyIdToUuid[r.userId],
    type: r.type,
    start_date: r.startDate,
    end_date: r.endDate,
    half_day: r.halfDay,
    reason: r.reason,
    status: r.status,
    is_negative: r.isNegative,
    negative_amount: r.negativeAmount,
    year: r.year,
    approved_by_id: legacyIdToUuid[r.approvedById] || null,
    approved_at: r.approvedAt || null,
    created_at: r.createdAt,
    updated_at: r.updatedAt
  })).filter(r => r.user_id)

  if (newRequests.length > 0) {
    // Clear existing
    await supabase.from('leave_requests').delete().neq('id', '0')
    const { error } = await supabase.from('leave_requests').insert(newRequests)
    if (error) console.error('  Error migrating requests:', error.message)
    else console.log(`  Migrated ${newRequests.length} requests with approval info.`)
  }

  // 3. Migrate CompOff entries (new migration)
  console.log('Migrating CompOff Work Entries...')
  const { data: legacyCompOff } = await supabase.from('CompOffWorkEntry').select('*')
  if (legacyCompOff && legacyCompOff.length > 0) {
    const newCompOff = legacyCompOff.map(c => ({
        user_id: legacyIdToUuid[c.userId],
        date_worked: c.dateWorked,
        hours_worked: c.hoursWorked,
        reason: c.reason,
        status: c.status,
        expiry_date: c.expiryDate,
        days_credited: c.daysCredited,
        approved_by_id: legacyIdToUuid[c.approvedById] || null,
        approved_at: c.approvedAt || null,
        created_at: c.createdAt,
        updated_at: c.updatedAt
    })).filter(c => c.user_id)

    await supabase.from('comp_off_work_entries').delete().neq('id', '0')
    const { error } = await supabase.from('comp_off_work_entries').insert(newCompOff)
    if (error) console.error('  Error migrating compoff:', error.message)
    else console.log(`  Migrated ${newCompOff.length} comp-off entries.`)
  }

  console.log('\n=== Migration Repair Complete! ===')
}

migrateData()
