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
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY

// Use anon key for signup (normal flow)
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const USERS = [
  { email: 'admin@company.com', password: 'Unique@123', name: 'Priya Sharma', role: 'ADMIN' },
  { email: 'manager@company.com', password: 'Unique@123', name: 'Rahul Verma', role: 'MANAGER' },
  { email: 'john@company.com', password: 'Unique@123', name: 'John Doe', role: 'EMPLOYEE' },
  { email: 'jane@company.com', password: 'Unique@123', name: 'Jane Smith', role: 'EMPLOYEE' },
  { email: 'amit@company.com', password: 'Unique@123', name: 'Amit Kumar', role: 'EMPLOYEE' },
]

async function createUsers() {
  console.log('--- Creating users via signUp (anon key) ---\n')

  for (const u of USERS) {
    console.log(`Creating: ${u.email}...`)
    
    const { data, error } = await supabase.auth.signUp({
      email: u.email,
      password: u.password,
      options: {
        data: { name: u.name, role: u.role }
      }
    })

    if (error) {
      console.error(`  FAILED: ${error.message}`)
    } else {
      console.log(`  SUCCESS: ID=${data.user?.id}`)
      console.log(`  Session: ${data.session ? 'Yes' : 'No (needs email confirmation)'}`)
    }
    console.log('')
  }

  // Now use service key to confirm all users and create profiles
  console.log('--- Confirming users with service key ---\n')
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
  if (listError) {
    console.error('Error listing users:', listError.message)
    return
  }

  console.log(`Found ${users.length} users in Auth. Confirming emails...`)
  
  for (const user of users) {
    if (!user.email_confirmed_at) {
      const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email_confirm: true
      })
      if (confirmError) {
        console.error(`  Failed to confirm ${user.email}: ${confirmError.message}`)
      } else {
        console.log(`  Confirmed: ${user.email}`)
      }
    } else {
      console.log(`  Already confirmed: ${user.email}`)
    }

    // Create profile entry
    const meta = user.user_metadata || {}
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        name: meta.name || user.email?.split('@')[0] || 'Employee',
        role: meta.role || 'EMPLOYEE',
        status: 'ACTIVE'
      }, { onConflict: 'id' })

    if (profileError) {
      console.error(`  Profile insert failed for ${user.email}: ${profileError.message}`)
    } else {
      console.log(`  Profile created: ${user.email}`)
    }
  }

  console.log('\n--- Final Auth Users ---')
  const { data: { users: finalUsers } } = await supabaseAdmin.auth.admin.listUsers()
  finalUsers.forEach(u => console.log(`  - ${u.email} (confirmed: ${!!u.email_confirmed_at})`))

  console.log('\n--- Done ---')
}

createUsers().catch(console.error)