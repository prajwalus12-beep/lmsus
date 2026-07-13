import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { calculateMonthlyPLAccrual } from '@/lib/accrualEngine'
import { syncUserLedger } from '@/lib/ledgerSync'
import { getSystemDate } from '@/lib/systemDate'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  const { month, year } = await req.json()
  const systemDate = await getSystemDate()

  const { data: users, error: usersError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('status', 'ACTIVE')

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

  const results: { user: string; monthsAccrued: string[]; totalAccrued: number }[] = []

  for (const user of (users || [])) {
    // 1. Check the last monthly accrual date for this user
    const { data: lastAccrual } = await supabaseAdmin
      .from('leave_balance_adjustments')
      .select('*')
      .eq('user_id', user.id)
      .eq('adjustment_type', 'MONTHLY_ACCRUAL')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const realToday = new Date()
    let startYear = realToday.getFullYear()
    let startMonth = realToday.getMonth()

    if (lastAccrual) {
      const lastDate = new Date(lastAccrual.created_at)
      // If the last accrual was created_at = 2026-08-01, it accrued for July 2026 (month = 6).
      // So the next month to accrue starts at loop month = August 2026 (month = 7, which is lastDate.getUTCMonth()).
      const nextMonth = lastDate.getUTCMonth() // 0-11
      const nextYear = lastDate.getUTCFullYear()

      const lastAccrualTimeVal = nextYear * 12 + nextMonth
      const realTodayTimeVal = realToday.getFullYear() * 12 + realToday.getMonth()

      if (lastAccrualTimeVal > realTodayTimeVal) {
        startMonth = nextMonth
        startYear = nextYear
      }
    }

    const targetTimeVal = year * 12 + month
    let loopYear = startYear
    let loopMonth = startMonth
    let loopTimeVal = loopYear * 12 + loopMonth

    const monthsAccrued: string[] = []
    let totalAccrued = 0

    while (loopTimeVal <= targetTimeVal) {
      const calc = await calculateMonthlyPLAccrual(supabaseAdmin, user.id, loopYear, loopMonth)
      
      if (calc.accrued > 0) {
        const accrualDate = new Date(loopYear, loopMonth + 1, 1).toISOString()
        const monthLabel = new Date(loopYear, loopMonth).toLocaleString('default', { month: 'short', year: 'numeric' })

        // Create adjustment
        const { error: adjError } = await supabaseAdmin
          .from('leave_balance_adjustments')
          .insert({
            user_id: user.id,
            leave_type: 'PL',
            amount: calc.accrued,
            adjustment_type: 'MONTHLY_ACCRUAL',
            reason: `Monthly PL Accrual (${calc.workingDays} working days: ${calc.totalDays}d - ${calc.weekendsCount}w - ${calc.holidaysCount}h - ${calc.leaveDaysCount}l)`,
            effective_year: loopYear,
            entered_by: sessionUser.id,
            entered_by_name: 'System (Auto)',
            created_at: accrualDate
          })

        if (adjError) {
          console.error(`Error saving adjustment for user ${user.id} in ${monthLabel}:`, adjError)
        } else {
          // Fetch or initialize leave balance for loopYear
          let { data: balance } = await supabaseAdmin
            .from('leave_balances')
            .select('*')
            .eq('user_id', user.id)
            .eq('year', loopYear)
            .maybeSingle()

          if (!balance) {
            const { data: newBalance, error: newBalError } = await supabaseAdmin
              .from('leave_balances')
              .insert({
                user_id: user.id,
                year: loopYear,
                opening_pl: 0,
                opening_cl: 7,
                opening_comp: 0,
                pl: 0,
                cl: 7,
                sl: 7,
                comp: 0,
                pl_accrued: 0,
                pl_used: 0,
                cl_used: 0,
                sl_used: 0,
                pl_carry_forward: 0,
                updated_at: systemDate.toISOString()
              })
              .select()
              .single()

            if (newBalError) {
              console.error(`Failed to create balance row for ${user.id} for year ${loopYear}:`, newBalError)
            } else {
              balance = newBalance
            }
          }

          if (balance) {
            await supabaseAdmin
              .from('leave_balances')
              .update({
                pl: (balance.pl || 0) + calc.accrued,
                pl_accrued: (balance.pl_accrued || 0) + calc.accrued,
                updated_at: systemDate.toISOString()
              })
              .eq('id', balance.id)
          }

          await syncUserLedger(user.id, loopYear)
          monthsAccrued.push(monthLabel)
          totalAccrued += calc.accrued
        }
      }

      // Advance one month
      loopMonth++
      if (loopMonth > 11) {
        loopMonth = 0
        loopYear++
      }
      loopTimeVal = loopYear * 12 + loopMonth
    }

    if (totalAccrued > 0) {
      results.push({
        user: user.name,
        monthsAccrued,
        totalAccrued: parseFloat(totalAccrued.toFixed(2))
      })
    }
  }

  return NextResponse.json({ success: true, results })
}
