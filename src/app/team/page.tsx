import { PrismaClient } from '@prisma/client'
import { TeamDataTable } from './TeamDataTable'
import { columns } from './columns'

const prisma = new PrismaClient()

export default async function TeamPage() {
  const users = await prisma.user.findMany({
    include: {
      department: true,
      balances: true
    },
    orderBy: { name: 'asc' }
  });

  const formattedData = users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department?.name || 'N/A',
    plBalance: user.balances?.pl || 0,
    clSlBalance: (user.balances?.cl || 0) + (user.balances?.sl || 0),
    joinDate: user.joinDate.toLocaleDateString(),
    lastWorkingDay: user.lastWorkingDay ? user.lastWorkingDay.toLocaleDateString() : null
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
