const fs = require('fs')
const content = fs.readFileSync('.env', 'utf8')
content.split('\n').forEach(line => {
  if (line.includes('SUPABASE_SERVICE_KEY') || line.includes('NEXT_PUBLIC_SUPABASE_URL')) {
    const [key, value] = line.split('=')
    console.log(`${key}: ${value ? (value.trim().substring(0, 10) + '...') : 'MISSING'}`)
  }
})
