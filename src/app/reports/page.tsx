import { getServerSession } from '@/lib/supabaseServer'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { ReportsClient } from './ReportsClient'

export default async function ReportsPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const currentYear = new Date().getFullYear()

  // Use Prisma to fetch all users and their details
  const users = await prisma.user.findMany({
    include: {
      department: true,
      balances: true,
      negativeLeaves: true
    },
    orderBy: { name: 'asc' }
  })

  const reportData = (users || []).map((user: any) => {
    let balance = user.balances.find((b: any) => b.year === currentYear) || user.balances[0] || null
    const negativeLeaves = user.negativeLeaves || []
    
    return {
      id: user.id,
      name: user.name,
      status: user.status,
      department: user.department?.name || 'N/A',
      // Opening balances
      openingPl: balance?.openingPl ?? 0,
      openingCl: balance?.openingCl ?? 0,
      openingComp: balance?.openingComp ?? 0,
      // Current balances
      pl: balance?.pl ?? 0,
      cl: balance?.cl ?? 0,
      sl: balance?.sl ?? 0,
      comp: balance?.comp ?? 0,
      // Accrual / Used
      plAccrued: balance?.plAccrued ?? 0,
      plUsed: balance?.plUsed ?? 0,
      clUsed: balance?.clUsed ?? 0,
      slUsed: balance?.slUsed ?? 0,
      // Carry forward
      plCarryForward: balance?.plCarryForward ?? 0,
      // Negative tracking
      negativeTracking: negativeLeaves.map((n: any) => ({
        id: n.id,
        userId: n.userId,
        leaveRequestId: n.leaveRequestId,
        leaveType: n.leaveType,
        negativeDays: n.negativeDays,
        dailySalary: n.dailySalary,
        recoveryAmount: n.recoveryAmount,
        status: n.status,
        recoveredAt: n.recoveredAt ? n.recoveredAt.toISOString() : null,
        remarks: n.remarks,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString()
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
