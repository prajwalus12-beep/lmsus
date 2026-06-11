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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const USERS = [
  { email: 'admin@company.com', password: 'Unique@123', name: 'Priya Sharma', role: 'ADMIN' },
  { email: 'manager@company.com', password: 'Unique@123', name: 'Rahul Verma', role: 'MANAGER' },
  { email: 'john@company.com', password: 'Unique@123', name: 'John Doe', role: 'EMPLOYEE' },
  { email: 'jane@company.com', password: 'Unique@123', name: 'Jane Smith', role: 'EMPLOYEE' },
  { email: 'amit@company.com', password: 'Unique@123', name: 'Amit Kumar', role: 'EMPLOYEE' },
  { email: 'alice.wong@company.com', password: 'Unique@123', name: 'Alice Wong', role: 'EMPLOYEE' },
  { email: 'diana.prince@company.com', password: 'Unique@123', name: 'Diana Prince', role: 'EMPLOYEE' },
]

async function createUsers() {
  console.log('--- Creating users in Supabase Auth ---\n')

  for (const u of USERS) {
    console.log(`Creating: ${u.email}...`)
    
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { name: u.name, role: u.role }
    })

    if (error) {
      console.error(`  FAILED: ${error.message}`)
    } else {
      console.log(`  SUCCESS: ID=${data.user.id}`)
      
      // Also create a profile entry
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: 'ACTIVE'
        }, { onConflict: 'id' })

      if (profileError) {
        console.error(`  Profile insert failed: ${profileError.message}`)
      } else {
        console.log(`  Profile created successfully`)
      }
    }
    console.log('')
  }

  console.log('--- Done ---')
}

createUsers().catch(console.error)