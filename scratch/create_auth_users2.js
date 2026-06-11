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
      if (error.message.includes('Database error')) {
        console.log('  -> This is likely a trigger/FK issue. Trying alternative approach...')
      }
    } else {
      console.log(`  SUCCESS: ID=${data.user.id}`)
    }
    console.log('')
  }

  // Check if any users were created
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
  if (listError) {
    console.error('Error listing users:', listError.message)
  } else {
    console.log(`\nTotal users in Auth: ${users.length}`)
    users.forEach(u => console.log(`  - ${u.email} (${u.id})`))
  }

  console.log('\n--- Done ---')
}

createUsers().catch(console.error)