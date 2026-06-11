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

async function fixProfiles() {
  console.log('--- Updating profiles with department_id and join_date ---')
  
  const { data: legacyUsers } = await supabase.from('User').select('*')
  const { data: newProfiles } = await supabase.from('profiles').select('*')
  const { data: legacyDepts } = await supabase.from('Department').select('*')
  const { data: newDepts } = await supabase.from('departments').select('*')

  const emailToUuid = {}
  newProfiles.forEach(p => emailToUuid[p.email] = p.id)

  const deptNameToNewId = {}
  newDepts.forEach(d => deptNameToNewId[d.name] = d.id)

  const legacyDeptIdToName = {}
  legacyDepts.forEach(d => legacyDeptIdToName[d.id] = d.name)

  for (const u of legacyUsers) {
    const uuid = emailToUuid[u.email]
    const deptName = legacyDeptIdToName[u.departmentId]
    const newDeptId = deptNameToNewId[deptName]
    
    if (uuid) {
      console.log(`Updating profile for ${u.email}...`)
      await supabase.from('profiles').update({
        department_id: newDeptId || null,
        join_date: u.joinDate,
        days_worked: u.daysWorked,
        status: u.status
      }).eq('id', uuid)
    }
  }
}

fixProfiles()
