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

const EMP_ID = '0d6afccf-6ce7-4632-b52c-b940aeaaf620'; // Prajwal Chaudhari
const ADMIN_ID = 'bac371b3-bfb0-44ad-bc46-48aa21d4045b'; // Priya Sharma

async function main() {
  console.log('--- Cleaning up existing dummy data for Prajwal Chaudhari ---');
  
  await supabase.from('leave_ledger_entries').delete().eq('user_id', EMP_ID);
  await supabase.from('leave_requests').delete().eq('user_id', EMP_ID);
  await supabase.from('leave_balance_adjustments').delete().eq('user_id', EMP_ID);
  await supabase.from('carry_forward_histories').delete().eq('user_id', EMP_ID);
  await supabase.from('comp_off_work_entries').delete().eq('user_id', EMP_ID);
  await supabase.from('negative_leave_trackings').delete().eq('user_id', EMP_ID);

  console.log('--- Updating user profile join date & status ---');
  await supabase.from('profiles').update({
    join_date: '2025-08-15T00:00:00+00:00',
    status: 'ACTIVE',
    updated_at: new Date().toISOString()
  }).eq('id', EMP_ID);

  console.log('--- Resetting leave balances for 2026 ---');
  await supabase.from('leave_balances').update({
    year: 2026,
    opening_pl: 6.0,
    opening_cl: 7.0,
    opening_comp: 0.0,
    pl: 12.0,
    cl: 6.0,
    sl: 6.0,
    comp: 0.0,
    lop: 0.0,
    mat: 0.0,
    pl_accrued: 7.5,
    pl_used: 1.5,
    cl_used: 1.0,
    sl_used: 1.0,
    pl_carry_forward: 6.0,
    updated_at: new Date().toISOString()
  }).eq('user_id', EMP_ID);

  console.log('--- Inserting carry forward history (2025 -> 2026) ---');
  await supabase.from('carry_forward_histories').insert({
    user_id: EMP_ID,
    from_year: 2025,
    to_year: 2026,
    leave_type: 'PL',
    carry_forward_days: 6.0,
    expired_days: 0.0,
    max_carry_limit: 30.0,
    processed_by: ADMIN_ID
  });

  console.log('--- Inserting approved leave requests ---');
  
  // Request 1: PL request for 1.0 day
  const { data: pl1 } = await supabase.from('leave_requests').insert({
    user_id: EMP_ID,
    type: 'PL',
    start_date: '2026-03-10T00:00:00+00:00',
    end_date: '2026-03-10T23:59:59+00:00',
    half_day: 'NONE',
    reason: 'Doctor appointment',
    status: 'HR_APPROVED',
    is_negative: false,
    negative_amount: 0.0,
    year: 2026,
    approved_by_id: ADMIN_ID,
    approved_at: '2026-03-09T10:00:00+00:00',
    created_at: '2026-03-08T09:00:00+00:00',
    updated_at: '2026-03-09T10:00:00+00:00'
  }).select().single();

  // Request 2: PL half-day request for 0.5 day
  const { data: pl2 } = await supabase.from('leave_requests').insert({
    user_id: EMP_ID,
    type: 'PL',
    start_date: '2026-04-15T00:00:00+00:00',
    end_date: '2026-04-15T23:59:59+00:00',
    half_day: 'FIRST_HALF',
    reason: 'Personal paperwork',
    status: 'HR_APPROVED',
    is_negative: false,
    negative_amount: 0.0,
    year: 2026,
    approved_by_id: ADMIN_ID,
    approved_at: '2026-04-14T11:00:00+00:00',
    created_at: '2026-04-12T14:00:00+00:00',
    updated_at: '2026-04-14T11:00:00+00:00'
  }).select().single();

  // Request 3: CL request for 1.0 day
  const { data: cl1 } = await supabase.from('leave_requests').insert({
    user_id: EMP_ID,
    type: 'CL',
    start_date: '2026-02-10T00:00:00+00:00',
    end_date: '2026-02-10T23:59:59+00:00',
    half_day: 'NONE',
    reason: 'Family wedding attendance',
    status: 'HR_APPROVED',
    is_negative: false,
    negative_amount: 0.0,
    year: 2026,
    approved_by_id: ADMIN_ID,
    approved_at: '2026-02-09T15:00:00+00:00',
    created_at: '2026-02-08T10:00:00+00:00',
    updated_at: '2026-02-09T15:00:00+00:00'
  }).select().single();

  // Request 4: SL request for 1.0 day
  const { data: sl1 } = await supabase.from('leave_requests').insert({
    user_id: EMP_ID,
    type: 'SL',
    start_date: '2026-05-12T00:00:00+00:00',
    end_date: '2026-05-12T23:59:59+00:00',
    half_day: 'NONE',
    reason: 'Flu symptoms',
    status: 'HR_APPROVED',
    is_negative: false,
    negative_amount: 0.0,
    year: 2026,
    approved_by_id: ADMIN_ID,
    approved_at: '2026-05-12T09:30:00+00:00',
    created_at: '2026-05-12T08:00:00+00:00',
    updated_at: '2026-05-12T09:30:00+00:00'
  }).select().single();

  console.log('--- Inserting leave balance adjustments (accruals) ---');
  const adjustments = [
    { leave_type: 'PL', amount: 1.5, reason: 'Monthly PL Accrual (Jan 2026)', date: '2026-02-01T00:00:05+00:00' },
    { leave_type: 'PL', amount: 1.5, reason: 'Monthly PL Accrual (Feb 2026)', date: '2026-03-01T00:00:05+00:00' },
    { leave_type: 'PL', amount: 1.5, reason: 'Monthly PL Accrual (Mar 2026)', date: '2026-04-01T00:00:05+00:00' },
    { leave_type: 'PL', amount: 1.5, reason: 'Monthly PL Accrual (Apr 2026)', date: '2026-05-01T00:00:05+00:00' },
    { leave_type: 'PL', amount: 1.5, reason: 'Monthly PL Accrual (May 2026)', date: '2026-06-01T00:00:05+00:00' }
  ];
  for (const adj of adjustments) {
    await supabase.from('leave_balance_adjustments').insert({
      user_id: EMP_ID,
      leave_type: adj.leave_type,
      amount: adj.amount,
      adjustment_type: 'MONTHLY_ACCRUAL',
      reason: adj.reason,
      effective_year: 2026,
      entered_by: ADMIN_ID,
      entered_by_name: 'System (Auto)',
      created_at: adj.date
    });
  }

  console.log('--- Inserting Leave Ledger Entries ---');
  const ledgerRows = [
    // 1. Opening
    { date: '2026-01-01T00:00:00+00:00', type: 'OPENING', description: 'Opening Balance — 1 Jan 2026', is_opening: true, cl_balance: 6.0, pl_balance: 6.0 },
    // 2. Jan Accrual
    { date: '2026-02-01T00:00:05+00:00', type: 'ACCRUAL', description: 'Monthly PL Accrual (Jan 2026)', is_adjustment: true, days: 1.5, pl_credit: 1.5, cl_balance: 6.0, pl_balance: 7.5 },
    // 3. CL request
    { date: '2026-02-10T00:00:00+00:00', type: 'CL', description: 'Family wedding attendance', start_date: '2026-02-10T00:00:00+00:00', end_date: '2026-02-10T23:59:59+00:00', days: 1.0, cl_debit: 1.0, cl_balance: 5.0, pl_balance: 7.5 },
    // 4. Feb Accrual
    { date: '2026-03-01T00:00:05+00:00', type: 'ACCRUAL', description: 'Monthly PL Accrual (Feb 2026)', is_adjustment: true, days: 1.5, pl_credit: 1.5, cl_balance: 5.0, pl_balance: 9.0 },
    // 5. PL request
    { date: '2026-03-10T00:00:00+00:00', type: 'PL', description: 'Doctor appointment', start_date: '2026-03-10T00:00:00+00:00', end_date: '2026-03-10T23:59:59+00:00', days: 1.0, pl_debit: 1.0, cl_balance: 5.0, pl_balance: 8.0 },
    // 6. Mar Accrual
    { date: '2026-04-01T00:00:05+00:00', type: 'ACCRUAL', description: 'Monthly PL Accrual (Mar 2026)', is_adjustment: true, days: 1.5, pl_credit: 1.5, cl_balance: 5.0, pl_balance: 9.5 },
    // 7. PL half day request
    { date: '2026-04-15T00:00:00+00:00', type: 'PL', description: 'Personal paperwork', start_date: '2026-04-15T00:00:00+00:00', end_date: '2026-04-15T23:59:59+00:00', days: 0.5, pl_debit: 0.5, cl_balance: 5.0, pl_balance: 9.0 },
    // 8. Apr Accrual
    { date: '2026-05-01T00:00:05+00:00', type: 'ACCRUAL', description: 'Monthly PL Accrual (Apr 2026)', is_adjustment: true, days: 1.5, pl_credit: 1.5, cl_balance: 5.0, pl_balance: 10.5 },
    // 9. SL request (note: SL doesn't change CL or PL balance)
    { date: '2026-05-12T00:00:00+00:00', type: 'SL', description: 'Flu symptoms', start_date: '2026-05-12T00:00:00+00:00', end_date: '2026-05-12T23:59:59+00:00', days: 1.0, cl_balance: 5.0, pl_balance: 10.5 },
    // 10. May Accrual
    { date: '2026-06-01T00:00:05+00:00', type: 'ACCRUAL', description: 'Monthly PL Accrual (May 2026)', is_adjustment: true, days: 1.5, pl_credit: 1.5, cl_balance: 5.0, pl_balance: 12.0 },
    // 11. Closing
    { date: new Date().toISOString(), type: 'CLOSING', description: 'Closing Balance (as of today)', is_closing: true, cl_balance: 6.0, pl_balance: 12.0 }
  ];

  for (const row of ledgerRows) {
    await supabase.from('leave_ledger_entries').insert({
      user_id: EMP_ID,
      date: row.date,
      type: row.type,
      description: row.description,
      start_date: row.start_date || null,
      end_date: row.end_date || null,
      days: row.days || null,
      cl_debit: row.cl_debit || null,
      pl_debit: row.pl_debit || null,
      cl_credit: row.cl_credit || null,
      pl_credit: row.pl_credit || null,
      cl_balance: row.cl_balance,
      pl_balance: row.pl_balance,
      is_opening: row.is_opening || false,
      is_adjustment: row.is_adjustment || false,
      is_closing: row.is_closing || false
    });
  }

  // 9. Insert an approved Comp-Off log for testing
  console.log('--- Inserting Comp-Off log and tracking ---');
  await supabase.from('comp_off_work_entries').insert({
    user_id: EMP_ID,
    date_worked: '2026-05-01T00:00:00+00:00',
    hours_worked: 8.0,
    reason: 'Production release deployment',
    status: 'APPROVED',
    expiry_date: '2026-08-01T00:00:00+00:00',
    days_credited: 1.0,
    approved_by_id: ADMIN_ID,
    approved_at: '2026-05-02T10:00:00+00:00'
  });

  console.log('✅ Prajwal Chaudhari dummy calculations data has been successfully generated in Supabase!');
}

main()
  .catch(console.error);
