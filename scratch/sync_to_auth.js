const { PrismaClient } = require('@prisma/client')
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Simple .env parser
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
const prisma = new PrismaClient()

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
  console.log('You MUST add SUPABASE_SERVICE_KEY to your .env file to sync users to Auth.')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function syncToAuth() {
  console.log('--- Syncing Prisma Users to Supabase Auth ---')
  
  const users = await prisma.user.findMany()
  console.log(`Found ${users.length} users in Prisma database.`)

  for (const user of users) {
    console.log(`Processing: ${user.email}...`)
    
    // 1. Check if user already exists in Auth
    const { data: { users: authUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      console.error('Error listing auth users:', listError.message)
      break
    }

    const existingAuthUser = authUsers.find(u => u.email.toLowerCase() === user.email.toLowerCase())

    if (existingAuthUser) {
      console.log(`  - User already exists in Supabase Auth (ID: ${existingAuthUser.id})`)
      continue
    }

    // 2. Create user in Auth
    // Note: We use a default password 'Unique@123' because we can't reverse the Prisma hash
    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: 'Unique@123',
      email_confirm: true,
      user_metadata: { name: user.name, role: user.role }
    })

    if (createError) {
      console.error(`  - FAILED to create auth user: ${createError.message}`)
    } else {
      console.log(`  - SUCCESS: Created in Supabase Auth (ID: ${newAuthUser.user.id})`)
      
      // OPTIONAL: Update the User table ID to match Supabase Auth ID if they aren't synced
      // This is often necessary because the 'profiles' table should use the Auth UUID
      console.log(`  - NOTE: You may need to update your 'User' table ID to ${newAuthUser.user.id}`)
    }
  }

  console.log('--- Sync Complete ---')
}

syncToAuth()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
