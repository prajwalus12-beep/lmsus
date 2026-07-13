import { getSupabaseServer } from './supabaseServer'
import { supabaseAdmin } from './supabaseAdmin'
import { calculateRequestedDays } from './leaveCalculator'
import { getSystemDate } from './systemDate'

export async function syncUserLedger(userId: string, year: number = 2026) {
  const systemDate = await getSystemDate()
  const startOfYear = `${year}-01-01T00:00:00.000Z`
  const endOfYear = `${year}-12-31T23:59:59.999Z`

  const supabase = supabaseAdmin // Use admin to ensure full access

  const [
    { data: user },
    { data: holidays },
    { data: sandwichConfig }
  ] = await Promise.all([
    supabase.from('profiles').select('*, leave_balances(*)').eq('id', userId).single(),
    supabase.from('holidays').select('*').gte('date', startOfYear).lte('date', endOfYear),
    supabase.from('system_configs').select('value').eq('key', 'weekend_sandwich_rule').single()
  ])

  if (!user) return
  const balance = Array.isArray(user.leave_balances) 
    ? user.leave_balances.find((b: any) => b.year === year) 
    : (user.leave_balances && user.leave_balances.year === year ? user.leave_balances : null)
  if (!balance) return

  const holidayDates = new Set((holidays || []).map((h: any) => h.date.split('T')[0]))
  const isSandwichEnabled = sandwichConfig?.value === 'true'

  // Clear existing ledger entries for this user and year
  await supabase
    .from('leave_ledger_entries')
    .delete()
    .eq('user_id', user.id)
    .gte('date', startOfYear)
    .lte('date', endOfYear)

  let clBal = balance.opening_cl || 0
  let plBal = balance.opening_pl || 0
  let compBal = balance.opening_comp || 0
  
  let plAccrued = 0
  let plUsed = 0
  let clUsed = 0
  let slUsed = 0

  const [
    { data: approvedLeaves },
    { data: adjustments },
    { data: compOffCredits }
  ] = await Promise.all([
    supabase.from('leave_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'HR_APPROVED')
      .gte('start_date', startOfYear)
      .lte('start_date', endOfYear)
      .order('start_date', { ascending: true }),
    supabase.from('leave_balance_adjustments')
      .select('*')
      .eq('user_id', user.id)
      .eq('effective_year', year)
      .order('created_at', { ascending: true }),
    supabase.from('comp_off_work_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'APPROVED')
      .gte('date_worked', startOfYear)
      .lte('date_worked', endOfYear)
      .order('date_worked', { ascending: true })
  ])

  const ledgerEntries: any[] = []

  // Add Opening Entry
  ledgerEntries.push({
    user_id: user.id,
    date: startOfYear,
    type: 'OPENING',
    description: `Opening Balance — 1 Jan ${year}`,
    cl_credit: balance.opening_cl || 0,
    pl_credit: balance.opening_pl || 0,
    cl_balance: clBal,
    pl_balance: plBal,
    is_opening: true,
    is_adjustment: false,
    is_closing: false,
    working_days: 0
  })

  const events = [
    ...(approvedLeaves || []).map((l: any) => ({ kind: 'leave' as const, date: new Date(l.start_date), data: l })),
    ...(adjustments || []).map((a: any) => ({ kind: 'adj' as const, date: new Date(a.created_at), data: a })),
    ...(compOffCredits || []).map((c: any) => ({ kind: 'comp_credit' as const, date: new Date(c.date_worked), data: c }))
  ].sort((a, b) => a.date.getTime() - b.date.getTime())

  for (const ev of events) {
    if (ev.kind === 'leave') {
      const leave = ev.data
      const { days, effectiveType } = calculateRequestedDays(
        new Date(leave.start_date),
        new Date(leave.end_date),
        holidayDates,
        isSandwichEnabled,
        leave.type,
        leave.half_day !== 'NONE'
      )

      if (days === 0) continue

      let clDebit = null, plDebit = null
      if (effectiveType === 'CL') { clDebit = days; clBal -= days; clUsed += days; }
      else if (effectiveType === 'PL') { plDebit = days; plBal -= days; plUsed += days; }
      else if (effectiveType === 'SL') { clDebit = days; clBal -= days; slUsed += days; }
      else if (effectiveType === 'COMP') { compBal -= days; }
      else continue

      ledgerEntries.push({
        user_id: user.id,
        date: leave.start_date,
        type: effectiveType,
        description: leave.reason,
        start_date: leave.start_date,
        end_date: leave.end_date,
        days,
        cl_debit: clDebit,
        pl_debit: plDebit,
        cl_balance: clBal,
        pl_balance: plBal,
        is_opening: false,
        is_adjustment: false,
        is_closing: false
      })
    } else if (ev.kind === 'comp_credit') {
      const credit = ev.data
      compBal += credit.days_credited
      ledgerEntries.push({
        user_id: user.id,
        date: credit.date_worked,
        type: 'COMP_CREDIT',
        description: `Comp-Off Earned: ${credit.reason}`,
        days: credit.days_credited,
        cl_balance: clBal,
        pl_balance: plBal,
        is_opening: false,
        is_adjustment: false,
        is_closing: false
      })
    } else {
      const adj = ev.data
      let clDebit = null, clCredit = null, plDebit = null, plCredit = null

      if (adj.leave_type === 'CL') {
        if (adj.amount < 0) { clDebit = Math.abs(adj.amount); clUsed += clDebit; }
        else { clCredit = adj.amount }
        clBal += adj.amount
      } else if (adj.leave_type === 'PL') {
        if (adj.amount < 0) { plDebit = Math.abs(adj.amount); plUsed += plDebit; }
        else { plCredit = adj.amount; if (adj.adjustment_type === 'MONTHLY_ACCRUAL') plAccrued += adj.amount; }
        plBal += adj.amount
      } else if (adj.leave_type === 'COMP') {
        compBal += adj.amount
      }

      ledgerEntries.push({
        user_id: user.id,
        date: adj.created_at,
        type: adj.adjustment_type === 'MONTHLY_ACCRUAL' ? 'ACCRUAL' : `ADJ-${adj.leave_type}`,
        description: adj.reason,
        days: Math.abs(adj.amount),
        cl_debit: clDebit,
        cl_credit: clCredit,
        cl_balance: clBal,
        pl_balance: plBal,
        is_opening: false,
        is_adjustment: true,
        is_closing: false
      })
    }
  }

  // Add Closing Entry
  ledgerEntries.push({
    user_id: user.id,
    date: systemDate.toISOString(),
    type: 'CLOSING',
    description: 'Closing Balance (as of today)',
    cl_balance: clBal,
    pl_balance: plBal,
    is_opening: false,
    is_adjustment: false,
    is_closing: true
  })

  await supabase.from('leave_ledger_entries').insert(ledgerEntries)

  // Sync master balance table with all components for the specified year
  await supabase
    .from('leave_balances')
    .update({
      pl: plBal,
      cl: clBal,
      comp: compBal,
      pl_accrued: plAccrued,
      pl_used: plUsed,
      cl_used: clUsed,
      sl_used: slUsed,
      updated_at: systemDate.toISOString()
    })
    .eq('user_id', user.id)
    .eq('year', year)
}
