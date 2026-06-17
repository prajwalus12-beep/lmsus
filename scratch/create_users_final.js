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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const users = [
  { email: 'admin@yopmail.com', password: 'Unique@123', name: 'Priya Sharma', role: 'ADMIN' },
  { email: 'manager@yopmail.com', password: 'Unique@123', name: 'Rahul Verma', role: 'MANAGER' },
  { email: 'john@yopmail.com', password: 'Unique@123', name: 'John Doe', role: 'EMPLOYEE' },
  { email: 'jane@yopmail.com', password: 'Unique@123', name: 'Jane Smith', role: 'EMPLOYEE' },
  { email: 'amit@yopmail.com', password: 'Unique@123', name: 'Amit Kumar', role: 'EMPLOYEE' },
  { email: 'alice.wong@yopmail.com', password: 'Unique@123', name: 'Alice Wong', role: 'EMPLOYEE' },
  { email: 'diana.prince@yopmail.com', password: 'Unique@123', name: 'Diana Prince', role: 'EMPLOYEE' },
]

async function createUsers() {
  console.log('=== Creating users in Supabase Auth via admin SDK ===\n')
  
  for (const u of users) {
    console.log(`Creating: ${u.email} (${u.name})...`)
    
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { name: u.name, role: u.role }
    })
    
    if (error) {
      // Check if it's a duplicate key error
      if (error.message?.includes('already exists') || error.message?.includes('duplicate key')) {
        console.log(`  ⚠️  Already exists (will try to update password instead)`)
        
        // Try to find the user by email and update password
        const { data: listData } = await supabase.auth.admin.listUsers()
        const existingUser = listData?.users?.find(lu => lu.email === u.email)
        
        if (existingUser) {
          console.log(`  Found user: ${existingUser.id}`)
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password: u.password, email_confirm: true }
          )
          if (updateError) {
            console.log(`  ❌ Update failed: ${updateError.message}`)
          } else {
            console.log(`  ✅ Password updated!`)
          }
        } else {
          console.log(`  ❌ Could not find user to update`)
        }
      } else {
        console.log(`  ❌ ${error.message}`)
      }
    } else {
      console.log(`  ✅ Created! ID: ${data.user.id}`)
      
      // Update the profile with the correct name and role
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ name: u.name, role: u.role })
        .eq('id', data.user.id)
      
      if (profileError) {
        console.log(`  ⚠️  Profile update: ${profileError.message}`)
      } else {
        console.log(`  ✅ Profile updated with name: ${u.name}, role: ${u.role}`)
      }
    }
  }
  
  console.log('\n=== Done! ===')
}

createUsers().catch(console.error)