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

async function mapData() {
  console.log('--- Mapping User (Prisma) to profiles (Supabase) ---')
  const { data: legacyUsers } = await supabase.from('User').select('id, email, name')
  const { data: newProfiles } = await supabase.from('profiles').select('id, email, name')

  const emailToUuid = {}
  newProfiles.forEach(p => {
    emailToUuid[p.email] = p.id
  })

  console.log('\nMapping:')
  legacyUsers.forEach(u => {
    const uuid = emailToUuid[u.email]
    console.log(`${u.name} (${u.email}): Legacy ID ${u.id} -> New ID ${uuid || 'NOT FOUND'}`)
  })

  console.log('\n--- Checking LeaveRequest for John Doe (john@company.com) ---')
  const johnLegacy = legacyUsers.find(u => u.email === 'john@company.com')
  if (johnLegacy) {
    const { data: requests } = await supabase.from('LeaveRequest').select('*').eq('userId', johnLegacy.id)
    console.log(`Found ${requests?.length || 0} legacy requests for John.`)
  }
}

mapData()
