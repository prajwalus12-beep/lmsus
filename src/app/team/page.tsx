import prisma from '@/lib/prisma'
import { TeamDataTable } from './TeamDataTable'
import { columns } from './columns'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const users = await prisma.user.findMany({
    include: {
      department: true,
      balances: true,
    },
    where: {
      role: { not: 'ADMIN' }, // De-link HR accounts from employee directory
    },
    orderBy: { name: 'asc' },
  });

  const formattedData = users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    department: user.department?.name || 'N/A',
    departmentId: user.departmentId || '',
    plBalance: user.balances?.pl || 0,
    clSlBalance: (user.balances?.cl || 0) + (user.balances?.sl || 0),
    joinDate: user.joinDate.toLocaleDateString(),
    lastWorkingDay: user.lastWorkingDay ? user.lastWorkingDay.toLocaleDateString() : null,
    probationEndDate: user.probationEndDate ? user.probationEndDate.toISOString().split('T')[0] : null,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team Directory</h1>
        <p className="text-slate-500">Manage employees, view balances, and prorate leaves for new joiners.</p>
      </div>
      
      <div className="bg-white border rounded-xl shadow-sm">
        <TeamDataTable columns={columns} data={formattedData} />
      </div>
    </div>
  )
}
