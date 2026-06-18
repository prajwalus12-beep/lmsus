import { getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { redirect } from 'next/navigation'
import { ReportsClient } from './ReportsClient'

export default async function ReportsPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const currentYear = new Date().getFullYear()

  // Use supabaseAdmin to bypass RLS for complete organizational reports
  const { data: users, error } = await supabaseAdmin
    .from('profiles')
    .select('*, departments(name), leave_balances(*), negative_leave_trackings(*)')
    .order('name', { ascending: true })

  if (error) {
    console.error("Error fetching reports data:", error)
  }

  const reportData = (users || []).map((user: any) => {
    // Handle leave_balances which might be an array or a single object
    let balance = null
    if (Array.isArray(user.leave_balances)) {
      balance = user.leave_balances.find((b: any) => b.year === currentYear) || user.leave_balances[0] || null
    } else if (user.leave_balances) {
      balance = user.leave_balances
    }
    
    const negativeLeaves = Array.isArray(user.negative_leave_trackings) ? user.negative_leave_trackings : []
    
    const dept = Array.isArray(user.departments) ? user.departments[0] : user.departments
    const deptName = dept?.name || 'N/A'

    return {
      id: user.id,
      name: user.name,
      status: user.status,
      department: deptName,
      // Opening balances
      openingPl: balance?.opening_pl ?? 0,
      openingCl: balance?.opening_cl ?? 0,
      openingComp: balance?.opening_comp ?? 0,
      // Current balances
      pl: balance?.pl ?? 0,
      cl: balance?.cl ?? 0,
      sl: balance?.sl ?? 0,
      comp: balance?.comp ?? 0,
      // Accrual / Used
      plAccrued: balance?.pl_accrued ?? 0,
      plUsed: balance?.pl_used ?? 0,
      clUsed: balance?.cl_used ?? 0,
      slUsed: balance?.sl_used ?? 0,
      // Carry forward
      plCarryForward: balance?.pl_carry_forward ?? 0,
      // Negative tracking
      negativeTracking: negativeLeaves.map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        leaveRequestId: n.leave_request_id,
        leaveType: n.leave_type,
        negativeDays: n.negative_days,
        dailySalary: n.daily_salary,
        recoveryAmount: n.recovery_amount,
        status: n.status,
        recoveredAt: n.recovered_at,
        remarks: n.remarks,
        createdAt: n.created_at,
        updatedAt: n.updated_at
      }))
    }
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-slate-500">Full leave ledger per Rule 46 — opening, accrued, used, carry-forward, and negative leave sections.</p>
      </div>
      <ReportsClient data={reportData} />
    </div>
  )
}
