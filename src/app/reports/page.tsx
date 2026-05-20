import { PrismaClient } from '@prisma/client'
import { ReportsClient } from './ReportsClient'

const prisma = new PrismaClient()

export default async function ReportsPage() {
  const users = await prisma.user.findMany({
    include: { 
      balances: true, 
      department: true,
      negativeLeaves: true
    },
    orderBy: { name: 'asc' }
  })

  const reportData = users.map(user => ({
    id: user.id,
    name: user.name,
    department: user.department?.name || 'N/A',
    // Opening balances (Rule 47)
    openingPl: user.balances?.openingPl ?? 0,
    openingCl: user.balances?.openingCl ?? 0,
    openingComp: user.balances?.openingComp ?? 0,
    // Current balances
    pl: user.balances?.pl ?? 0,
    cl: user.balances?.cl ?? 0,
    sl: user.balances?.sl ?? 0,
    comp: user.balances?.comp ?? 0,
    // Accrual / Used
    plAccrued: user.balances?.plAccrued ?? 0,
    plUsed: user.balances?.plUsed ?? 0,
    clUsed: user.balances?.clUsed ?? 0,
    slUsed: user.balances?.slUsed ?? 0,
    // Carry forward
    plCarryForward: user.balances?.plCarryForward ?? 0,
    // Negative tracking
    negativeTracking: user.negativeLeaves || []
  }))

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
