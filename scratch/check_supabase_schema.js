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

async function checkSchema() {
  console.log('=== Checking Supabase Schema ===\n')

  // 1. Check what tables exist in public schema
  console.log('1. Tables in public schema:')
  const { data: tables, error: tablesError } = await supabaseAdmin
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .is('table_type', 'BASE TABLE')
  
  if (tablesError) {
    console.log(`  Error: ${tablesError.message}`)
  } else {
    tables?.forEach(t => console.log(`  - ${t.table_name}`))
  }

  // 2. Check profiles table columns
  console.log('\n2. Profiles table columns:')
  const { data: columns, error: colError } = await supabaseAdmin
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_name', 'profiles')
    .eq('table_schema', 'public')
  
  if (colError) {
    console.log(`  Error: ${colError.message}`)
  } else {
    columns?.forEach(c => console.log(`  - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable}, default: ${c.column_default || 'none'})`))
  }

  // 3. Check foreign keys on profiles
  console.log('\n3. Foreign keys on profiles:')
  const { data: fks, error: fkError } = await supabaseAdmin
    .from('information_schema.table_constraints')
    .select('constraint_name, constraint_type')
    .eq('table_name', 'profiles')
    .eq('table_schema', 'public')
  
  if (fkError) {
    console.log(`  Error: ${fkError.message}`)
  } else {
    fks?.forEach(fk => console.log(`  - ${fk.constraint_name} (${fk.constraint_type})`))
  }

  // 4. Check if there's a trigger on auth.users by looking at the profiles table definition
  console.log('\n4. Checking if profiles.id references auth.users...')
  const { data: refs, error: refError } = await supabaseAdmin
    .from('information_schema.referential_constraints')
    .select('constraint_name, unique_constraint_name, delete_rule, update_rule')
    .eq('constraint_name', 'profiles_id_fkey')
  
  if (refError) {
    console.log(`  Error: ${refError.message}`)
  } else {
    console.log(`  References: ${JSON.stringify(refs, null, 2)}`)
  }

  // 5. Try to query the User table (Prisma)
  console.log('\n5. User table (Prisma) records:')
  const { data: users, error: userError } = await supabaseAdmin
    .from('User')
    .select('id, name, email, role')
    .limit(10)
  
  if (userError) {
    console.log(`  Error: ${userError.message}`)
  } else {
    users?.forEach(u => console.log(`  - ${u.name} (${u.email}) [${u.role}]`))
  }

  // 6. Check if there's a handle_new_user trigger function
  console.log('\n6. Checking for trigger functions...')
  const { data: funcs, error: funcError } = await supabaseAdmin
    .from('information_schema.routines')
    .select('routine_name, routine_type')
    .eq('routine_schema', 'public')
    .ilike('routine_name', '%handle%new%user%')
  
  if (funcError) {
    console.log(`  Error: ${funcError.message}`)
  } else {
    console.log(`  Functions: ${JSON.stringify(funcs)}`)
  }
}

checkSchema().catch(console.error)