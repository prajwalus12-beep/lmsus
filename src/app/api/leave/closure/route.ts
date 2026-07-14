import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'
import { syncUserLedger } from '@/lib/ledgerSync'
import { getSystemDate, getSystemDateTime } from '@/lib/systemDate'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  const body = await req.json()
  const { year, remarks } = body as { year: number, remarks?: string }

  if (!year) {
    return NextResponse.json({ error: 'Year is required' }, { status: 400 })
  }

  const supabase = await getSupabaseServer()
  const systemDate = await getSystemDate()

  try {
    // 1. Check if year is already closed
    const { data: existing } = await supabase
      .from('leave_year_closures')
      .select('*')
      .eq('year', year)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: `Year ${year} is already closed.` }, { status: 400 })
    }

    // 2. Fetch all active leave balances
    const { data: balances, error: balError } = await supabase
      .from('leave_balances')
      .select('*')

    if (balError) throw new Error(balError.message)

    const { data: maxCfConfig } = await supabase
      .from('system_configs')
      .select('value')
      .eq('key', 'MAX_CARRY_FORWARD_PL')
      .maybeSingle()

    const NEXT_YEAR = year + 1
    const MAX_PL_CARRY_FORWARD = maxCfConfig ? parseFloat(maxCfConfig.value) : 30 // Rule 47
    const CL_ENTITLEMENT = 7 // Standard CL Entitlement

    const carryForwardHistoryInserts = []
    const auditLogInserts = []

    for (const balance of (balances || [])) {
      const currentPl = balance.pl || 0
      const carryForwardPl = Math.min(currentPl, MAX_PL_CARRY_FORWARD)
      const expiredPl = Math.max(0, currentPl - MAX_PL_CARRY_FORWARD)

      // 3. Record Carry Forward History (Rule 47)
      const sysDateTimeStr = (await getSystemDateTime()).toISOString()
      carryForwardHistoryInserts.push({
        user_id: balance.user_id,
        from_year: year,
        to_year: NEXT_YEAR,
        leave_type: 'PL',
        carry_forward_days: carryForwardPl,
        expired_days: expiredPl,
        max_carry_limit: MAX_PL_CARRY_FORWARD,
        processed_by: sessionUser.id,
        processed_at: sysDateTimeStr
      })

      // 4. Create the new LeaveBalance for the new year
      const { error: insertError } = await supabase
        .from('leave_balances')
        .insert({
          user_id: balance.user_id,
          year: NEXT_YEAR,
          opening_pl: carryForwardPl,
          opening_cl: CL_ENTITLEMENT,
          opening_comp: 0,
          pl: carryForwardPl,
          cl: CL_ENTITLEMENT,
          sl: 7, // Reset SL entitlement
          comp: 0,
          pl_accrued: 0,
          pl_used: 0,
          cl_used: 0,
          sl_used: 0,
          pl_carry_forward: carryForwardPl,
          updated_at: sysDateTimeStr
        })

      if (insertError) throw new Error(insertError.message)

      // Sync the new year's ledger entries (opening balance, etc.)
      try {
        await syncUserLedger(balance.user_id, NEXT_YEAR)
      } catch (syncErr: any) {
        console.error(`Failed to sync initial ledger for user ${balance.user_id} in ${NEXT_YEAR}:`, syncErr.message)
      }

      // 5. Prep Audit Log
      auditLogInserts.push({
        user_id: sessionUser.id,
        action: 'YEAR_CLOSED',
        entity: 'LeaveYearClosure',
        entity_id: String(year),
        metadata: JSON.stringify({
          userId: balance.user_id,
          carriedForward: carryForwardPl,
          expired: expiredPl
        }),
        created_at: sysDateTimeStr
      })
    }

    if (carryForwardHistoryInserts.length > 0) {
      const { error: cfError } = await supabase.from('carry_forward_histories').insert(carryForwardHistoryInserts)
      if (cfError) console.error("Error creating carry forward histories:", cfError)
    }

    if (auditLogInserts.length > 0) {
      const { error: logError } = await supabase.from('audit_logs').insert(auditLogInserts)
      if (logError) console.error("Error creating audit logs:", logError)
    }

    const sysDateTimeStr = (await getSystemDateTime()).toISOString()
    const { data: closure, error: closureError } = await supabase
      .from('leave_year_closures')
      .insert({
        year,
        closed_by: sessionUser.id,
        status: 'CLOSED',
        remarks: remarks ?? '',
        carry_forward_processed: true,
        closed_at: sysDateTimeStr,
        created_at: sysDateTimeStr
      })
      .select()
      .single()

    if (closureError) throw new Error(closureError.message)

    return NextResponse.json({ success: true, closure })
  } catch (error: any) {
    console.error('Closure Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
