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
  console.log('=== DATA MIGRATION: Legacy to New Schema ===\n')

  // 1. Get mappings
  const { data: legacyUsers } = await supabase.from('User').select('*')
  const { data: newProfiles } = await supabase.from('profiles').select('*')
  const { data: legacyDepts } = await supabase.from('Department').select('*')
  const { data: newDepts } = await supabase.from('departments').select('*')

  const emailToUuid = {}
  newProfiles.forEach(p => emailToUuid[p.email] = p.id)

  const legacyIdToUuid = {}
  legacyUsers.forEach(u => legacyIdToUuid[u.id] = emailToUuid[u.email])

  const deptNameToNewId = {}
  newDepts.forEach(d => deptNameToNewId[d.name] = d.id)

  const legacyDeptIdToNewId = {}
  legacyDepts.forEach(d => legacyDeptIdToNewId[d.id] = deptNameToNewId[d.name])

  // 2. Migrate Leave Balances
  console.log('Migrating Leave Balances...')
  const { data: legacyBalances } = await supabase.from('LeaveBalance').select('*')
  for (const b of legacyBalances) {
    const uuid = legacyIdToUuid[b.userId]
    if (uuid) {
      const { error } = await supabase.from('leave_balances').upsert({
        user_id: uuid,
        year: b.year,
        opening_pl: b.openingPl,
        opening_cl: b.openingCl,
        opening_comp: b.openingComp,
        pl: b.pl,
        cl: b.cl,
        sl: b.sl,
        comp: b.comp,
        lop: b.lop,
        mat: b.mat,
        pl_accrued: b.plAccrued,
        pl_used: b.plUsed,
        cl_used: b.clUsed,
        sl_used: b.slUsed,
        pl_carry_forward: b.plCarryForward,
        created_at: b.createdAt,
        updated_at: b.updatedAt
      }, { onConflict: 'user_id' })
      if (error) console.error(`  Error balance for ${uuid}:`, error.message)
    }
  }

  // 3. Migrate Leave Requests
  console.log('Migrating Leave Requests...')
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
    created_at: r.createdAt,
    updated_at: r.updatedAt
  })).filter(r => r.user_id)

  if (newRequests.length > 0) {
    // Clear existing to avoid duplicates if re-run
    await supabase.from('leave_requests').delete().neq('id', '0')
    const { error } = await supabase.from('leave_requests').insert(newRequests)
    if (error) console.error('  Error migrating requests:', error.message)
    else console.log(`  Migrated ${newRequests.length} requests.`)
  }

  // 4. Migrate Negative Tracking
  console.log('Migrating Negative Leave Tracking...')
  const { data: legacyNegative } = await supabase.from('NegativeLeaveTracking').select('*')
  const newNegative = legacyNegative.map(n => ({
    user_id: legacyIdToUuid[n.userId],
    leave_type: n.leaveType,
    negative_days: n.negativeDays,
    daily_salary: n.dailySalary,
    recovery_amount: n.recoveryAmount,
    status: n.status,
    remarks: n.remarks,
    created_at: n.createdAt,
    updated_at: n.updatedAt
  })).filter(n => n.user_id)

  if (newNegative.length > 0) {
    await supabase.from('negative_leave_trackings').delete().neq('id', '0')
    const { error } = await supabase.from('negative_leave_trackings').insert(newNegative)
    if (error) console.error('  Error migrating negative tracking:', error.message)
    else console.log(`  Migrated ${newNegative.length} tracking records.`)
  }

  console.log('\n=== Migration Complete! ===')
}

migrateData()
