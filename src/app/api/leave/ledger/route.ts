import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { syncUserLedger } from '@/lib/ledgerSync'

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const targetUserId = searchParams.get('userId') || session.user.id
  const year = parseInt(searchParams.get('year') || '2026')

  try {
    const startOfYear = `${year}-01-01T00:00:00.000Z`
    const endOfYear = `${year}-12-31T23:59:59.999Z`

    // Pre-sync ledger to ensure it is dynamically calculated up-to-date
    await syncUserLedger(targetUserId, year)

    const [
      { data: user, error: userError },
      { data: balance, error: balError },
      { data: entries, error: entriesError }
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*, departments(name)').eq('id', targetUserId).single(),
      supabaseAdmin.from('leave_balances').select('*').eq('user_id', targetUserId).eq('year', year).maybeSingle(),
      supabaseAdmin.from('leave_ledger_entries')
        .select('*')
        .eq('user_id', targetUserId)
        .gte('date', startOfYear)
        .lte('date', endOfYear)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true })
    ])

    if (userError || !user) return NextResponse.json({ error: userError?.message || 'User not found' }, { status: 404 })
    if (balError || !balance) return NextResponse.json({ error: balError?.message || 'Balance not found' }, { status: 404 })
    if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 })

    return NextResponse.json({
      user: { 
        id: user.id, 
        name: user.name, 
        department: (Array.isArray(user.departments) ? user.departments[0]?.name : user.departments?.name) || 'N/A' 
      },
      balance: {
        openingCl: balance.opening_cl,
        openingPl: balance.opening_pl,
        currentCl: balance.cl,
        currentPl: balance.pl,
      },
      entries: (entries || []).map((e: any) => ({
        id: e.id,
        userId: e.user_id,
        date: new Date(e.date).toISOString(),
        type: e.type,
        description: e.description,
        startDate: e.start_date ? new Date(e.start_date).toISOString() : null,
        endDate: e.end_date ? new Date(e.end_date).toISOString() : null,
        days: e.days,
        clDebit: e.cl_debit,
        clCredit: e.cl_credit,
        clBalance: e.cl_balance,
        plDebit: e.pl_debit,
        plCredit: e.pl_credit,
        plBalance: e.pl_balance,
        compBalance: e.comp_balance, // Include if exists
        workingDays: e.working_days,
        isOpening: e.is_opening,
        isAdjustment: e.is_adjustment,
        isClosing: e.is_closing,
        createdAt: new Date(e.created_at).toISOString(),
        updatedAt: new Date(e.updated_at).toISOString()
      }))
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
