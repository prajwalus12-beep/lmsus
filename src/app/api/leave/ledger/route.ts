import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { calculateRequestedDays } from '@/lib/leaveCalculator'
import { getCachedHolidays, getCachedConfig } from '@/lib/cachedData'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const targetUserId = searchParams.get('userId') || (session.user as any).id
  const year = parseInt(searchParams.get('year') || '2026')

  try {
    // 1. Fetch Dynamic Data (Leaves, Balance, Adjustments) 
    // AND Cached Data (Holidays, Config) in Parallel
    const [user, balance, holidays, leaves, adjustments, config] = await Promise.all([
      prisma.user.findUnique({ where: { id: targetUserId }, include: { department: true } }),
      prisma.leaveBalance.findFirst({ where: { userId: targetUserId, year } }),
      getCachedHolidays(year),
      prisma.leaveRequest.findMany({
        where: {
          userId: targetUserId,
          status: 'HR_APPROVED',
          startDate: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) },
        },
        orderBy: { startDate: 'asc' },
      }),
      prisma.auditLog.findMany({
        where: { targetId: targetUserId, action: 'MANUAL_ADJUSTMENT' },
        orderBy: { createdAt: 'asc' }
      }),
      getCachedConfig("weekend_sandwich_rule")
    ]);

    if (!user || !balance) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))
    const isSandwichEnabled = config?.value === "true"
    const events: any[] = []

    for (const leave of leaves) {
      const { days } = calculateRequestedDays(leave.startDate, leave.endDate, holidayDates, isSandwichEnabled, leave.type)
      events.push({
        date: leave.startDate,
        type: leave.type,
        description: `Approved ${leave.type} Leave`,
        change: -days,
        status: 'APPROVED'
      })
    }

    // Adjustments...
    for (const adj of adjustments) {
       try {
         const details = JSON.parse(adj.details)
         events.push({
           date: adj.createdAt,
           type: details.leaveType,
           description: `Manual Adjustment: ${adj.reason}`,
           change: details.newValue - details.oldValue,
           status: 'SYSTEM'
         })
       } catch (e) {}
    }

    return NextResponse.json({
      user: { name: user.name, department: user.department?.name },
      balance,
      events: events.sort((a, b) => a.date.getTime() - b.date.getTime())
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
