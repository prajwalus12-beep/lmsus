import { getServerSession } from '@/lib/supabaseServer'
import prisma from '@/lib/prisma'
import { TeamDataTable } from './TeamDataTable'
import { columns } from './columns'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  // Restrict Team Directory to ADMIN and MANAGER
  if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
    return <div className="p-8 text-center text-red-500">Access Denied: You do not have permission to view the Team Directory.</div>
  }

  // Use Prisma to fetch users, balances, and departments separately
  const [
    users,
    allBalances,
    allDepts
  ] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' }
      },
      include: {
        department: true
      },
      orderBy: { name: 'asc' }
    }),
    prisma.leaveBalance.findMany({
      orderBy: { year: 'desc' }
    }),
    prisma.department.findMany({
      select: { name: true },
      orderBy: { name: 'asc' }
    })
  ])

  const departments = (allDepts || []).map(d => d.name)

  const balanceMap = new Map()
  if (allBalances) {
    allBalances.forEach(b => {
      if (!balanceMap.has(b.userId)) {
        balanceMap.set(b.userId, b)
      }
    })
  }

  const formattedData = (users || []).map((user: any) => {
    const balance = balanceMap.get(user.id) || null
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      department: user.department?.name || 'N/A',
      departmentId: user.departmentId || '',
      plBalance: balance?.pl ?? 0,
      clSlBalance: balance?.cl ?? 0,
      joinDate: user.joinDate?.toISOString() || null, 
      lastWorkingDay: user.lastWorkingDay?.toISOString() || null, 
      probationEndDate: user.probationEndDate?.toISOString() || null, 
      displayJoinDate: user.joinDate ? new Date(user.joinDate).toLocaleDateString() : '—',
      displayLwd: user.lastWorkingDay ? new Date(user.lastWorkingDay).toLocaleDateString() : '—',
    }
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team Directory</h1>
        <p className="text-slate-500">Manage employees, view balances, and prorate leaves for new joiners.</p>
      </div>
      
      <div className="bg-white border rounded-xl shadow-sm">
        <TeamDataTable columns={columns} data={formattedData} currentUserRole={session.user.role} departments={departments} />
      </div>
    </div>
  )
}
