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

async function trySignIn() {
  console.log('=== Trying to sign in with existing credentials ===\n')
  
  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const testAccounts = [
    { email: 'admin@company.com', password: 'Unique@123', name: 'Priya Sharma' },
    { email: 'manager@company.com', password: 'Unique@123', name: 'Rahul Verma' },
    { email: 'john@company.com', password: 'Unique@123', name: 'John Doe' },
    { email: 'jane@company.com', password: 'Unique@123', name: 'Jane Smith' },
    { email: 'amit@company.com', password: 'Unique@123', name: 'Amit Kumar' },
  ]

  for (const acct of testAccounts) {
    console.log(`Trying ${acct.email}...`)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: acct.email,
      password: acct.password,
    })
    
    if (error) {
      console.log(`  ❌ ${error.message}`)
    } else {
      console.log(`  ✅ Signed in! User: ${data.user.email}`)
      console.log(`  Session: ${data.session ? 'Yes' : 'No'}`)
    }
    
    // Sign out to clear session for next attempt
    await supabase.auth.signOut()
  }
}

trySignIn().catch(console.error)