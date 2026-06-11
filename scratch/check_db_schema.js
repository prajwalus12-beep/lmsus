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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

async function run() {
  // Check what tables exist in public schema
  const { data: tables, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1)
  console.log('Profiles query result:', { data: tables, error: error?.message })

  // Try to get profiles table info via raw query
  const { data: rawTables, error: rawErr } = await supabase
    .from('_prisma_migrations')
    .select('*')
    .limit(5)
  console.log('Prisma migrations:', { data: rawTables, error: rawErr?.message })

  // List all tables we can access
  const { data: userTables, error: userErr } = await supabase
    .from('User')
    .select('*')
    .limit(1)
  console.log('User table query:', { data: userTables, error: userErr?.message })
}

run().catch(console.error)