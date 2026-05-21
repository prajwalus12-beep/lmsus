import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import { BalancesClient } from './BalancesClient'

export const dynamic = 'force-dynamic'

export default async function OpeningBalancesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold text-red-600">Access Denied</h1>
        <p className="text-slate-500 mt-2">Only HR/Admin can manage opening balances.</p>
      </div>
    )
  }

  const users = await prisma.user.findMany({
    where: { 
      role: { not: 'ADMIN' },
      status: { in: ['ACTIVE', 'NOTICE_PERIOD'] }
    },
    include: {
      balances: true,
      department: true
    },
    orderBy: { name: 'asc' }
  })

  const formattedUsers = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    department: u.department?.name || 'N/A',
    openingPl: u.balances?.openingPl || 0,
    openingCl: u.balances?.openingCl || 0,
    openingComp: u.balances?.openingComp || 0,
    currentPl: u.balances?.pl || 0,
    currentCl: u.balances?.cl || 0
  }))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Opening Balance Management</h1>
        <p className="text-slate-500">View and edit employee opening leave balances for the current year.</p>
      </div>
      
      <BalancesClient initialUsers={formattedUsers} />
    </div>
  )
}
