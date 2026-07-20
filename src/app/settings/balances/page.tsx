import { getServerSession } from '@/lib/supabaseServer'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { BalancesClient } from './BalancesClient'

export const dynamic = 'force-dynamic'

export default async function OpeningBalancesPage() {
  const session = await getServerSession()
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

  // Use Prisma to fetch data
  const [
    users,
    allDepts
  ] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
        status: { in: ['ACTIVE', 'NOTICE_PERIOD'] }
      },
      include: {
        department: true,
        balances: true
      },
      orderBy: { name: 'asc' }
    }),
    prisma.department.findMany({
      select: { name: true },
      orderBy: { name: 'asc' }
    })
  ])

  const departments = (allDepts || []).map(d => d.name)
  const currentYear = new Date().getFullYear()

  const formattedUsers = (users || []).map((u: any) => {
    let balance = u.balances.find((b: any) => b.year === currentYear) || [...u.balances].sort((a: any, b: any) => b.year - a.year)[0] || null

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      department: u.department?.name || 'N/A',
      openingPl: balance?.openingPl || 0,
      openingCl: balance?.openingCl || 0,
      openingComp: balance?.openingComp || 0,
      currentPl: balance?.pl || 0,
      currentCl: balance?.cl || 0
    }
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Opening Balance Management</h1>
        <p className="text-slate-500">View and edit employee opening leave balances for the current year.</p>
      </div>
      
      <BalancesClient initialUsers={formattedUsers} departments={departments} />
    </div>
  )
}
