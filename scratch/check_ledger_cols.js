const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
      env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
  return env;
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data, error } = await supabase.rpc('inspect_table', { table_name: 'leave_ledger_entries' });
  if (error) {
    // If RPC doesn't exist, try a direct query for one row and keys
    const { data: row, error: rowError } = await supabase.from('leave_ledger_entries').select('*').limit(1);
    if (rowError) {
        console.error("Error fetching row:", rowError);
    } else if (row && row.length > 0) {
        console.log("Columns:", Object.keys(row[0]));
    } else {
        console.log("No data in table, cannot determine columns via select *");
        // Try information schema via raw sql if possible? No, supabase client doesn't support raw sql easily without RPC.
    }
  } else {
    console.log("Table info:", data);
  }
}

main();
