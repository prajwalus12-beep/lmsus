import { getServerSession } from '@/lib/supabaseServer'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { CalendarClient } from './CalendarClient'
import { getSystemDate } from '@/lib/systemDate'

export default async function CalendarPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const sessionUser = session?.user as any;
  const sysDate = await getSystemDate()

  // Fetch approved requests, holidays, and departments using Prisma
  const [requests, holidays, allDepts] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        status: { in: ['HR_APPROVED', 'L1_APPROVED'] }
      },
      include: {
        user: {
          include: { department: true }
        }
      }
    }),
    prisma.holiday.findMany(),
    prisma.department.findMany({
      select: { name: true },
      orderBy: { name: 'asc' }
    })
  ])

  const formattedRequests = (requests || []).map((req: any) => {
    return {
      id: req.id,
      userId: req.userId,
      title: `${req.user?.name || 'Unknown'} - ${req.type}`,
      email: req.user?.email || '',
      startDate: req.startDate.toISOString(),
      endDate: req.endDate.toISOString(),
      department: req.user?.department?.name || 'N/A',
      status: req.status,
    }
  });

  const formattedHolidays = (holidays || []).map((h: any) => ({
    id: h.id,
    name: h.name,
    date: h.date.toISOString(),
  }));

  const departments = (allDepts || []).map(d => d.name);

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team Calendar</h1>
        <p className="text-slate-500">View approved leaves and public holidays.</p>
      </div>
      
      <div className="flex-1 min-h-[600px] bg-white border rounded-xl shadow-sm overflow-hidden p-6">
        <CalendarClient 
          requests={formattedRequests} 
          holidays={formattedHolidays}
          departments={departments}
          currentUserId={sessionUser?.id}
          initialDateStr={sysDate.toISOString()}
        />
      </div>
    </div>
  )
}
