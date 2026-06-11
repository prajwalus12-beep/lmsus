const { Client } = require('pg')

const connectionString = "postgresql://postgres.ulwoyxlnmtfnbfpfujtq:vM3DWBEeq29yQBCA@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"

async function fixAuthUsers() {
  const client = new Client({ connectionString })
  
  try {
    await client.connect()
    console.log('Connected to database!\n')
    
    // First, delete the orphaned users from auth.users
    const emails = [
      'admin@company.com',
      'manager@company.com', 
      'john@company.com',
      'jane@company.com',
      'amit@company.com',
      'alice.wong@company.com',
      'diana.prince@company.com'
    ]
    
    console.log('=== Step 1: Delete orphaned profiles ===')
    const delProfiles = await client.query(
      `DELETE FROM public.profiles WHERE email = ANY($1) RETURNING id, email`,
      [emails]
    )
    console.log(`Deleted ${delProfiles.rowCount} profiles`)
    delProfiles.rows.forEach(r => console.log(`  - ${r.email} (${r.id})`))
    
    console.log('\n=== Step 2: Delete orphaned auth users ===')
    const delUsers = await client.query(
      `DELETE FROM auth.users WHERE email = ANY($1) RETURNING id, email`,
      [emails]
    )
    console.log(`Deleted ${delUsers.rowCount} users from auth.users`)
    delUsers.rows.forEach(r => console.log(`  - ${r.email} (${r.id})`))
    
    console.log('\n=== Step 3: Verify cleanup ===')
    const check = await client.query(
      `SELECT COUNT(*) FROM auth.users WHERE email = ANY($1)`,
      [emails]
    )
    console.log(`Remaining users with @company.com: ${check.rows[0].count}`)
    
    console.log('\n✅ Cleanup complete! Now run the create_users_final.js script to create fresh users.')
    
  } catch (err) {
    console.error('Error:', err.message)
    if (err.position) {
      console.error('Position:', err.position)
    }
  } finally {
    await client.end()
  }
}

fixAuthUsers()