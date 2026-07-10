import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { syncUserLedger } from '@/lib/ledgerSync'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  const body = await req.json()
  const { userId, leaveType, amount, adjustmentType, reason, effectiveYear } = body
  console.log("ADJUSTMENT POST ATTEMPT DETAILS:", { userId, leaveType, amount, adjustmentType, reason, effectiveYear, sessionUserId: sessionUser.id })

  if (!userId || !leaveType || amount === undefined || !adjustmentType || !reason || !effectiveYear) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    // 1. Create the adjustment record
    const { data: adjustment, error: adjError } = await supabaseAdmin
      .from('leave_balance_adjustments')
      .insert({
        user_id: userId,
        leave_type: leaveType,
        amount: parseFloat(amount),
        adjustment_type: adjustmentType,
        reason,
        effective_year: parseInt(effectiveYear),
        entered_by: sessionUser.id,
        entered_by_name: sessionUser.name
      })
      .select('*')
      .single()

    if (adjError || !adjustment) throw new Error(adjError?.message || "Failed to create adjustment")

    // 2. Fetch live balance
    const { data: balance, error: balError } = await supabaseAdmin
      .from('leave_balances')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (balError || !balance) throw new Error(balError?.message || 'User balance record not found')

    const typeKey = leaveType.toLowerCase() // pl, cl, sl, comp
    const currentVal = balance[typeKey] || 0

    // 3. Update live balance
    const { error: updateBalError } = await supabaseAdmin
      .from('leave_balances')
      .update({
        [typeKey]: currentVal + parseFloat(amount),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (updateBalError) throw new Error(updateBalError.message)

    // 4. Create Audit Log
    try {
      const { error: logError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          user_id: sessionUser.id,
          action: 'ADJUSTMENT_MADE',
          entity: 'LeaveBalanceAdjustment',
          entity_id: adjustment.id,
          new_value: String(currentVal + parseFloat(amount)),
          old_value: String(currentVal),
          metadata: JSON.stringify({ targetUserId: userId, leaveType, amount, reason })
        })

      if (logError) console.error("Error creating adjustment audit log:", logError)
    } catch (logError) {
      console.error("Error creating adjustment audit log:", logError)
    }

    // Keep ledger in sync
    await syncUserLedger(userId, parseInt(effectiveYear))

    return NextResponse.json({ success: true, adjustment })
  } catch (error: any) {
    console.error('Adjustment Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
