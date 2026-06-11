const { Client } = require('pg')

const connectionString = "postgresql://postgres.ulwoyxlnmtfnbfpfujtq:vM3DWBEeq29yQBCA@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"

async function checkAuthUsers() {
  const client = new Client({ connectionString })
  
  try {
    await client.connect()
    console.log('Connected to database!\n')
    
    // Check auth.users for the company emails
    const emails = [
      'admin@company.com',
      'manager@company.com', 
      'john@company.com',
      'jane@company.com',
      'amit@company.com',
      'alice.wong@company.com',
      'diana.prince@company.com'
    ]
    
    console.log('=== Checking auth.users ===')
    const result = await client.query(
      `SELECT id, email, email_confirmed_at, created_at, updated_at 
       FROM auth.users 
       WHERE email = ANY($1)`,
      [emails]
    )
    
    if (result.rows.length === 0) {
      console.log('No matching users found in auth.users')
    } else {
      console.log(`Found ${result.rows.length} users:\n`)
      result.rows.forEach(r => {
        console.log(`  - ${r.email} (${r.id})`)
        console.log(`    Confirmed: ${r.email_confirmed_at}`)
        console.log(`    Created: ${r.created_at}`)
        console.log(`    Updated: ${r.updated_at}`)
        console.log()
      })
    }
    
    // Check if there are any users with @company.com
    console.log('=== All users with @company.com ===')
    const allResult = await client.query(
      `SELECT id, email, created_at FROM auth.users WHERE email LIKE '%@company.com'`
    )
    console.log(`Found ${allResult.rows.length} users`)
    allResult.rows.forEach(r => {
      console.log(`  - ${r.email} (${r.id}) created: ${r.created_at}`)
    })
    
    // Check total users
    console.log('\n=== Total users in auth.users ===')
    const countResult = await client.query('SELECT COUNT(*) FROM auth.users')
    console.log(`Total: ${countResult.rows[0].count}`)
    
    // Check identities
    console.log('\n=== Checking auth.identities for @company.com ===')
    const idResult = await client.query(
      `SELECT i.id, i.user_id, i.provider, i.email 
       FROM auth.identities i 
       JOIN auth.users u ON u.id = i.user_id 
       WHERE u.email LIKE '%@company.com'`
    )
    console.log(`Found ${idResult.rows.length} identities`)
    idResult.rows.forEach(r => {
      console.log(`  - ${r.email} (user: ${r.user_id}, provider: ${r.provider})`)
    })
    
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await client.end()
  }
}

checkAuthUsers()