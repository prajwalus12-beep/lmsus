import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'
import { syncUserLedger } from '@/lib/ledgerSync'

export async function PUT(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, openingPl, openingCl, openingComp } = await req.json()
  const supabase = await getSupabaseServer()

  try {
    const { data: updatedBalance, error: updateError } = await supabase
      .from('leave_balances')
      .update({
        opening_pl: openingPl,
        opening_cl: openingCl,
        opening_comp: openingComp,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select('*')
      .single()

    if (updateError || !updatedBalance) {
      throw new Error(updateError?.message || "Failed to update leave balance")
    }

    // Create an audit log for this manual balance adjustment
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        user_id: sessionUser.id,
        action: 'OPENING_BALANCE_ADJUSTED',
        entity: 'LeaveBalance',
        entity_id: updatedBalance.id,
        new_value: JSON.stringify({ openingPl, openingCl, openingComp }),
        metadata: `HR adjusted opening balances for user ${userId}`
      })

    if (auditError) console.error("Error creating audit log:", auditError)

    // Keep ledger in sync
    await syncUserLedger(userId, updatedBalance.year)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
