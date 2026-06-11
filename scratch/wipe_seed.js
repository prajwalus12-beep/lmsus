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

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function clearTable(name) {
  console.log(`Clearing ${name}...`)
  const { data, error } = await supabase.from(name).select('id')
  if (error) {
    console.warn(`  - Could not list ${name}: ${error.message}`)
    return
  }
  
  if (data.length === 0) {
    console.log(`  - ${name} is already empty.`)
    return
  }

  const ids = data.map(i => i.id)
  const { error: delError } = await supabase.from(name).delete().in('id', ids)
  if (delError) {
    console.error(`  - FAILED to clear ${name}: ${delError.message}`)
  } else {
    console.log(`  - Successfully cleared ${data.length} records from ${name}.`)
  }
}

async function wipeSeed() {
  const tables = [
    'SeedUser', 'SeedDepartment', 'SeedLeaveBalance', 'SeedHoliday', 'SeedSystemConfig'
  ]

  for (const table of tables) {
    await clearTable(table)
  }
}

wipeSeed()
