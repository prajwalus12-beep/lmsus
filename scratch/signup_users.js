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
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY

// Use anon key for signUp (normal flow)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
// Use service key for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
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

async function signUpUsers() {
  console.log('=== Signing up users via normal auth flow ===\n')

  for (const u of USERS) {
    console.log(`Signing up: ${u.email}...`)
    
    const { data, error } = await supabaseAnon.auth.signUp({
      email: u.email,
      password: u.password,
      options: {
        data: { name: u.name, role: u.role }
      }
    })

    if (error) {
      console.error(`  FAILED: ${error.message}`)
    } else {
      console.log(`  SUCCESS: User created (ID: ${data.user?.id})`)
      console.log(`  Session: ${data.session ? 'Has session' : 'No session (check email)'}`)
      
      // If email confirmation is required, we need to confirm the user
      if (!data.session) {
        console.log(`  Confirming user with admin API...`)
        const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
          data.user.id,
          { email_confirm: true }
        )
        if (confirmError) {
          console.error(`  Confirm failed: ${confirmError.message}`)
        } else {
          console.log(`  User confirmed successfully`)
        }
      }
    }
    console.log('')
  }

  console.log('=== Done ===')
}

signUpUsers().catch(console.error)