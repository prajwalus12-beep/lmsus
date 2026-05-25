import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'
import { CalendarClient } from './CalendarClient'

const prisma = new PrismaClient()

export default async function CalendarPage() {
  const session = await getServerSession(authOptions)
  
  const sessionUser = session?.user as any;
  const isAdmin = sessionUser?.role === 'ADMIN';

  const whereClause: any = {
    status: { in: ['HR_APPROVED', 'L1_APPROVED'] }
  };

  if (!isAdmin && sessionUser?.id) {
    whereClause.userId = sessionUser.id;
  }

  const requests = await prisma.leaveRequest.findMany({
    where: whereClause,
    include: {
      user: {
        include: { department: true }
      }
    }
  });

  const holidays = await prisma.holiday.findMany();

  const formattedRequests = requests.map(req => ({
    id: req.id,
    title: `${req.user.name} - ${req.type}`,
    email: req.user.email,
    startDate: req.startDate.toISOString(),
    endDate: req.endDate.toISOString(),
    department: req.user.department?.name || 'N/A',
  }));

  const formattedHolidays = holidays.map(h => ({
    id: h.id,
    name: h.name,
    date: h.date.toISOString(),
  }));

  const departments = Array.from(new Set(requests.map(r => r.user.department?.name).filter(Boolean))) as string[];

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
          currentUserEmail={session?.user?.email || undefined}
        />
      </div>
    </div>
  )
}
