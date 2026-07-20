import { getServerSession } from '@/lib/supabaseServer'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { calculateRequestedDays } from '@/lib/leaveCalculator'
import { RegisterClient } from './RegisterClient'

export const dynamic = 'force-dynamic'

export default async function LeaveRegisterPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const sessionUser = session.user as any
  const isAdmin = sessionUser.role === 'ADMIN' || sessionUser.role === 'MANAGER'
  
  // Use Prisma to query leave requests
  let whereClause: any = {}
  if (sessionUser.role !== 'ADMIN' && sessionUser.role !== 'MANAGER') {
    whereClause.userId = sessionUser.id
  }

  const [
    requests,
    allDepts,
    holidays,
    config
  ] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        user: {
          include: { department: true }
        },
        approvedBy: true
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.department.findMany({
      select: { name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.holiday.findMany({
      select: { date: true }
    }),
    prisma.systemConfig.findUnique({
      where: { key: 'weekend_sandwich_rule' }
    })
  ])

  const holidayDates = new Set((holidays || []).map((h: any) => h.date.toISOString().split('T')[0]))
  const isSandwichEnabled = config?.value === 'true'

  const formattedData = (requests || []).map((req: any) => {
    const { days, effectiveType } = calculateRequestedDays(
      new Date(req.startDate),
      new Date(req.endDate),
      holidayDates,
      isSandwichEnabled,
      req.type,
      req.halfDay !== 'NONE'
    )

    return {
      id: req.id,
      employeeName: req.user?.name || 'Unknown',
      department: req.user?.department?.name || 'N/A',
      type: effectiveType,
      startDate: req.startDate,
      endDate: req.endDate,
      duration: days,
      appliedAt: req.createdAt,
      status: req.status,
      approvedAt: req.approvedAt || null,
      approvedByName: req.approvedBy?.name || '—'
    }
  })

  const departments = (allDepts || []).map((d: any) => d.name)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leave Register</h1>
        <p className="text-slate-500">Comprehensive log of all leave applications and their status.</p>
      </div>

      <RegisterClient initialRequests={formattedData} departments={departments} isAdmin={isAdmin} />
    </div>
  )
}
