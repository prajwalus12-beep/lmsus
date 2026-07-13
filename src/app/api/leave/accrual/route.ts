import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'
import { calculateMonthlyPLAccrual } from '@/lib/accrualEngine'
import { syncUserLedger } from '@/lib/ledgerSync'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  const { month, year } = await req.json()
  const supabase = await getSupabaseServer()

  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'ACTIVE')

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

  const results = []

  for (const user of (users || [])) {
    const calc = await calculateMonthlyPLAccrual(supabase, user.id, year, month)
    
    if (calc.accrued > 0) {
      // Create a manual adjustment for the accrual
      // effective date is end of month or start of next
      const accrualDate = new Date(year, month + 1, 1).toISOString()
      
      const { data: adj, error: adjError } = await supabase
        .from('leave_balance_adjustments')
        .insert({
          user_id: user.id,
          leave_type: 'PL',
          amount: calc.accrued,
          adjustment_type: 'MONTHLY_ACCRUAL',
          reason: `Monthly PL Accrual (${calc.workingDays} working days: ${calc.totalDays}d - ${calc.weekendsCount}w - ${calc.holidaysCount}h - ${calc.leaveDaysCount}l)`,
          effective_year: year,
          entered_by: sessionUser.id,
          entered_by_name: 'System (Auto)',
          created_at: accrualDate
        })
        .select('*')
        .single()

      if (adjError) {
        console.error(`Error saving adjustment for user ${user.id}:`, adjError)
        continue
      }

      // Fetch user's current leave balance for the accrual year
      const { data: balance } = await supabase
        .from('leave_balances')
        .select('pl, pl_accrued')
        .eq('user_id', user.id)
        .eq('year', year)
        .maybeSingle()

      if (balance) {
        // Update the user's actual balance for that year
        await supabase
          .from('leave_balances')
          .update({
            pl: (balance.pl || 0) + calc.accrued,
            pl_accrued: (balance.pl_accrued || 0) + calc.accrued,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('year', year)
      }

      await syncUserLedger(user.id, year)

      results.push({ user: user.name, accrued: calc.accrued })
    }
  }

  return NextResponse.json({ success: true, results })
}
