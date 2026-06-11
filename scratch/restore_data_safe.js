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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function restoreData() {
  console.log('--- RESTORING DATA FROM BACKUP (NO METADATA) ---')
  
  if (!fs.existsSync('data_backup.json')) {
    console.error('Error: data_backup.json not found!')
    return
  }

  const data = JSON.parse(fs.readFileSync('data_backup.json', 'utf8'))
  const userIdMap = {}

  // 1. Sync Users to Auth
  console.log('Restoring Users to Auth...')
  for (const u of data.users) {
    console.log(`Creating user: ${u.email}...`)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: "Unique@123",
      email_confirm: true
      // No metadata here
    })

    if (authError) {
      console.error(`  - FAILED: ${authError.message}`)
      continue
    }

    const newUid = authData.user.id
    userIdMap[u.id] = newUid

    // 2. Manually populate profiles/User table
    console.log(`  - Populating DB records for ${u.email}...`)
    await supabaseAdmin.from('profiles').upsert({
      id: newUid,
      name: u.name,
      email: u.email,
      role: u.role,
      department_id: u.departmentId || null,
      join_date: u.joinDate,
      status: u.status,
      communication_email: u.communicationEmail,
      created_at: u.createdAt
    })
    
    await supabaseAdmin.from('User').upsert({
      id: newUid,
      name: u.name,
      email: u.email,
      role: u.role,
      departmentId: u.departmentId || null,
      joinDate: u.joinDate,
      status: u.status,
      communicationEmail: u.communicationEmail,
      createdAt: u.createdAt
    })
  }

  // ... (rest of restore logic)
  console.log('Restoring Departments...')
  for (const d of data.departments) {
    await supabaseAdmin.from('departments').upsert({ id: d.id, name: d.name, created_at: d.createdAt })
  }

  console.log('Restoring Leave Balances...')
  for (const b of data.leaveBalances) {
    const mappedId = userIdMap[b.userId]
    if (mappedId) {
      await supabaseAdmin.from('leave_balances').insert({
        user_id: mappedId, year: b.year, pl: b.pl, cl: b.cl, sl: b.sl, comp: b.comp,
        opening_pl: b.openingPl, opening_cl: b.openingCl, opening_comp: b.openingComp,
        pl_accrued: b.plAccrued, pl_used: b.plUsed, cl_used: b.clUsed, sl_used: b.slUsed,
        created_at: b.createdAt
      })
    }
  }

  console.log('Restoring Holidays...')
  for (const h of data.holidays) {
    await supabaseAdmin.from('holidays').upsert({ id: h.id, date: h.date, name: h.name, type: h.type, created_at: h.createdAt })
  }

  console.log('Restoring System Configs...')
  for (const c of data.systemConfigs) {
    await supabaseAdmin.from('system_configs').upsert({ id: c.id, key: c.key, value: c.value, created_at: c.createdAt })
  }

  console.log('Restoring Leave Requests...')
  for (const r of data.leaveRequests) {
    const mappedId = userIdMap[r.userId]
    if (mappedId) {
      await supabaseAdmin.from('leave_requests').insert({
        user_id: mappedId, type: r.type, start_date: r.startDate, end_date: r.endDate,
        reason: r.reason, status: r.status, is_negative: r.isNegative, negative_amount: r.negativeAmount,
        year: r.year, created_at: r.createdAt
      })
    }
  }

  console.log('--- Restore Complete! ---')
}

restoreData()
