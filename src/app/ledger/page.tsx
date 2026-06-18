import { getServerSession } from '@/lib/supabaseServer'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { LedgerClient } from './LedgerClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LedgerPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const sessionUser = session.user as any
  const role: string = sessionUser.role
  const userId: string = sessionUser.id
  const year = new Date().getFullYear()
  const isHR = role === 'ADMIN'

  const supabase = await getSupabaseServer()

  const startOfYear = `${year}-01-01T00:00:00.000Z`
  const endOfYear = `${year}-12-31T23:59:59.999Z`

  let allUsers: any[] = []
  if (isHR) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id, name, status, departments(name)')
      .in('status', ['ACTIVE', 'NOTICE_PERIOD'])
      .neq('role', 'ADMIN')
      .order('name', { ascending: true })
    allUsers = (data || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      status: u.status,
      department: { name: (Array.isArray(u.departments) ? u.departments[0]?.name : u.departments?.name) || 'N/A' }
    }))
  }

  let targetUserId = userId
  if (isHR && allUsers.length > 0) {
    targetUserId = allUsers[0].id
  }

  const [
    { data: clBalanceSetting },
    { data: profile },
    { data: ledgerEntries }
  ] = await Promise.all([
    supabaseAdmin.from('system_configs').select('value').eq('key', 'SHOW_CL_BALANCE_TO_EMPLOYEE').single(),
    supabaseAdmin.from('profiles').select('id, name, status, departments(name), leave_balances(*)').eq('id', targetUserId).single(),
    supabaseAdmin.from('leave_ledger_entries').select('*')
      .eq('user_id', targetUserId)
      .gte('date', startOfYear)
      .lte('date', endOfYear)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true })
  ])

  if (!profile || !profile.leave_balances) {
    return <div className="p-8 text-red-600">User balance data not found. Please contact HR.</div>
  }

  // Supabase joins can return arrays even for 1:1 relations
  const balances = Array.isArray(profile.leave_balances) ? profile.leave_balances[0] : profile.leave_balances
  const dept = Array.isArray(profile.departments) ? profile.departments[0] : profile.departments
  const deptName = dept?.name || 'N/A'
  
  const showClBalanceToEmployee = clBalanceSetting?.value === 'true'
  const showClBalance = isHR || showClBalanceToEmployee

  const entries = (ledgerEntries || []).map((e: any) => ({
    ...e,
    id: e.id,
    date: e.date,
    type: e.type,
    description: e.description,
    days: e.days,
    startDate: e.start_date || null,
    endDate: e.end_date || null,
    clDebit: e.cl_debit,
    plDebit: e.pl_debit,
    clCredit: e.cl_credit,
    plCredit: e.pl_credit,
    clBalance: e.cl_balance,
    plBalance: e.pl_balance,
    isOpening: e.is_opening,
    isAdjustment: e.is_adjustment,
    isClosing: e.is_closing,
    workingDays: e.working_days
  }))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leave Ledger</h1>
        <p className="text-slate-500 text-sm mt-1">
          Accounting-style register — every CL &amp; PL transaction with running balance.
        </p>
      </div>
      <LedgerClient
        initialEntries={entries as any}
        initialUser={{
          id: profile.id,
          name: profile.name,
          status: profile.status,
          department: deptName,
          openingCl: balances?.opening_cl || 0,
          openingPl: balances?.opening_pl || 0,
        }}
        currentCl={balances?.cl || 0}
        currentPl={balances?.pl || 0}
        allUsers={allUsers}
        role={role}
        year={year}
        showClBalance={showClBalance}
      />
    </div>
  )
}
