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

async function fixAll() {
  console.log('--- Initializing Balances for ALL Profiles ---')
  
  const { data: profiles, error: pError } = await supabase.from('profiles').select('id, email, name')
  if (pError) {
    console.error('Error fetching profiles:', pError.message)
    return
  }

  console.log(`Found ${profiles.length} profiles. Checking balances...`)

  for (const profile of profiles) {
    const { data: existing, error: eError } = await supabase
      .from('leave_balances')
      .select('id')
      .eq('user_id', profile.id)
      .maybeSingle()

    if (eError) {
      console.error(`Error checking balance for ${profile.email}:`, eError.message)
      continue
    }

    if (!existing) {
      console.log(`Creating default balances for ${profile.name} (${profile.email})...`)
      const { error: iError } = await supabase.from('leave_balances').insert({
        user_id: profile.id,
        year: 2026,
        pl: 12,
        cl: 7,
        sl: 7,
        comp: 1,
        opening_pl: 12,
        opening_cl: 7,
        opening_comp: 0
      })
      if (iError) console.error(`  Failed: ${iError.message}`)
      else console.log(`  Success!`)
    } else {
      console.log(`Balances already exist for ${profile.name} (${profile.email}).`)
    }
  }
  
  console.log('\n--- All balances checked and initialized. ---')
}

fixAll()
