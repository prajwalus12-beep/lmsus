const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  const content = fs.readFileSync(envPath, 'utf8')
  const env = {}
  content.split('\n').forEach(line => {
    const [key, ...value] = line.split('=')
    if (key && value) env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '')
  })
  return env
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function checkDatabaseState() {
  console.log('=== Checking Database State ===\n')

  // 1. Check auth schema triggers
  console.log('1. Checking auth schema triggers...')
  const { data: triggers, error: trigError } = await supabaseAdmin.rpc('exec_sql', {
    sql: `
      SELECT tgname, tgrelid::regclass AS table_name, 
             pg_get_triggerdef(oid) AS trigger_def
      FROM pg_trigger
      WHERE tgrelid::regclass::text LIKE 'auth.%'
        AND tgname NOT LIKE 'RI_ConstraintTrigger%'
    `
  })
  if (trigError) {
    console.log(`  RPC not available: ${trigError.message}`)
    console.log('  Trying direct query...')
  } else {
    console.log('  Triggers:', JSON.stringify(triggers, null, 2))
  }

  // 2. Check profiles table structure
  console.log('\n2. Checking profiles table...')
  const { data: profilesInfo, error: profError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .limit(5)
  if (profError) {
    console.log(`  Error: ${profError.message}`)
  } else {
    console.log(`  Profiles: ${JSON.stringify(profilesInfo)}`)
  }

  // 3. Check if there's a trigger on auth.users
  console.log('\n3. Checking for triggers on auth.users...')
  const { data: authTriggers, error: authTrigError } = await supabaseAdmin.rpc('exec_sql', {
    sql: `
      SELECT tgname, tgtype::integer, tgenabled,
             pg_get_triggerdef(oid) as trigger_def
      FROM pg_trigger
      WHERE tgrelid = 'auth.users'::regclass
    `
  })
  if (authTrigError) {
    console.log(`  RPC error: ${authTrigError.message}`)
  } else {
    console.log(`  Auth triggers: ${JSON.stringify(authTriggers, null, 2)}`)
  }

  // 4. Try to query auth.users directly via raw SQL
  console.log('\n4. Trying to query auth.users via raw SQL...')
  const { data: rawUsers, error: rawError } = await supabaseAdmin.rpc('exec_sql', {
    sql: 'SELECT id, email, email_confirmed_at FROM auth.users LIMIT 10'
  })
  if (rawError) {
    console.log(`  Cannot query auth.users: ${rawError.message}`)
  } else {
    console.log(`  Auth users: ${JSON.stringify(rawUsers, null, 2)}`)
  }

  // 5. Check if exec_sql function exists
  console.log('\n5. Checking available RPC functions...')
  const { data: funcs, error: funcError } = await supabaseAdmin.rpc('exec_sql', {
    sql: `
      SELECT proname, pronargs 
      FROM pg_proc 
      WHERE pronamespace = 'public'::regnamespace
        AND proname LIKE '%sql%' OR proname LIKE '%exec%'
    `
  })
  if (funcError) {
    console.log(`  Error: ${funcError.message}`)
  } else {
    console.log(`  Functions: ${JSON.stringify(funcs)}`)
  }

  // 6. Try a simpler approach - check if we can use the REST API directly
  console.log('\n6. Checking Supabase project health...')
  const healthUrl = `${supabaseUrl}/rest/v1/`
  try {
    const response = await fetch(healthUrl, {
      headers: { 'apikey': supabaseServiceKey }
    })
    console.log(`  REST API status: ${response.status}`)
  } catch (e) {
    console.log(`  REST API error: ${e.message}`)
  }
}

checkDatabaseState().catch(console.error)