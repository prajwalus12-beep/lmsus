import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'
import { LedgerClient } from './LedgerClient'
import { redirect } from 'next/navigation'
import { calculateRequestedDays } from '@/lib/leaveCalculator'

export const dynamic = 'force-dynamic'

import { startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns'

const prisma = new PrismaClient()

export default async function LedgerPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const sessionUser = session.user as any
  const role: string = sessionUser.role
  const userId: string = sessionUser.id
  const year = new Date().getFullYear()
  const isHR = role === 'ADMIN'

  // Read system setting: show CL balance to employees?
  const clBalanceSetting = await prisma.systemConfig.findUnique({
    where: { key: 'SHOW_CL_BALANCE_TO_EMPLOYEE' },
  })
  const showClBalanceToEmployee = clBalanceSetting?.value === 'true'
  const showClBalance = isHR || showClBalanceToEmployee

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { balances: true, department: true },
  })

  if (!user || !user.balances) {
    return <div className="p-8 text-red-600">User balance data not found. Please contact HR.</div>
  }

  const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`)
  const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`)

  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: startOfYear, lte: endOfYear } }
  })

  // Helper to calculate working days for a given month
  const getWorkingDaysForMonth = async (date: Date, targetUserId: string) => {
    try {
      const start = startOfMonth(date)
      const end = endOfMonth(date)
      const allDays = eachDayOfInterval({ start, end })
      
      const weekendsCount = allDays.filter(d => isWeekend(d)).length
      const monthHolidays = holidays.filter(h => h.date >= start && h.date <= end).length
      
      const monthLeaves = await prisma.leaveRequest.findMany({
        where: {
          userId: targetUserId,
          status: 'HR_APPROVED',
          startDate: { lte: end },
          endDate: { gte: start },
        }
      })

      let leaveDaysCount = 0
      for (const req of monthLeaves) {
        // Calculate actual days for this request, respecting weekends and holidays
        const { days } = await calculateRequestedDays(
          prisma,
          req.startDate < start ? start : req.startDate,
          req.endDate > end ? end : req.endDate,
          req.type,
          req.halfDay !== 'NONE'
        )
        leaveDaysCount += days
      }

      const res = allDays.length - weekendsCount - monthHolidays - leaveDaysCount
      return res > 0 ? res : 0
    } catch (e) {
      return null
    }
  }

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId,
      type: { in: ['CL', 'PL'] },
      status: 'HR_APPROVED',
      startDate: { gte: startOfYear, lte: endOfYear },
    },
    orderBy: { startDate: 'asc' },
  })

  const adjustments = await prisma.leaveBalanceAdjustment.findMany({
    where: { userId, leaveType: { in: ['CL', 'PL'] }, effectiveYear: year },
    orderBy: { createdAt: 'asc' },
  })

  const openingCl = user.balances.openingCl
  const openingPl = user.balances.openingPl
  let clBal = openingCl
  let plBal = openingPl

  const entries: any[] = [
    {
      id: 'opening',
      date: `${year}-01-01T00:00:00.000Z`,
      type: 'OPENING',
      description: `Opening Balance — 1 Jan ${year}`,
      days: null,
      startDate: null,
      endDate: null,
      clDebit: null,
      plDebit: null,
      clCredit: openingCl,
      plCredit: openingPl,
      clBalance: clBal,
      plBalance: plBal,
      status: null,
      isOpening: true,
      isAdjustment: false,
      isClosing: false,
      workingDays: await getWorkingDaysForMonth(new Date(`${year}-01-01T12:00:00`), userId),
    },
  ]

  type LeaveEv = { kind: 'leave'; date: Date; data: (typeof leaves)[0] }
  type AdjEv = { kind: 'adj'; date: Date; data: (typeof adjustments)[0] }
  const events: (LeaveEv | AdjEv)[] = [
    ...leaves.map((l) => ({ kind: 'leave' as const, date: l.startDate, data: l })),
    ...adjustments.map((a) => ({ kind: 'adj' as const, date: a.createdAt, data: a })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime())

  for (const ev of events) {
    const workingDays = await getWorkingDaysForMonth(ev.date, userId)

    if (ev.kind === 'leave') {
      const leave = ev.data
      
      const { days } = await calculateRequestedDays(
        prisma,
        leave.startDate,
        leave.endDate,
        leave.type,
        leave.halfDay !== 'NONE'
      )

      let clDebit: number | null = null
      let plDebit: number | null = null
      if (leave.type === 'CL') { clDebit = days; clBal -= days }
      else { plDebit = days; plBal -= days }

      entries.push({
        id: leave.id,
        date: leave.startDate.toISOString(),
        type: leave.type,
        description: leave.reason,
        days,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        clDebit,
        plDebit,
        clCredit: null,
        plCredit: null,
        clBalance: clBal,
        plBalance: plBal,
        status: leave.status,
        isOpening: false,
        isAdjustment: false,
        isClosing: false,
        workingDays,
      })
    } else {
      const adj = ev.data
      let clDebit: number | null = null
      let clCredit: number | null = null
      let plDebit: number | null = null
      let plCredit: number | null = null
      if (adj.leaveType === 'CL') {
        if (adj.amount < 0) { clDebit = Math.abs(adj.amount); clBal += adj.amount }
        else { clCredit = adj.amount; clBal += adj.amount }
      } else {
        if (adj.amount < 0) { plDebit = Math.abs(adj.amount); plBal += adj.amount }
        else { plCredit = adj.amount; plBal += adj.amount }
      }
      entries.push({
        id: adj.id,
        date: adj.createdAt.toISOString(),
        type: adj.adjustmentType === 'MONTHLY_ACCRUAL' ? 'ACCRUAL' : `ADJ-${adj.leaveType}`,
        description: adj.reason,
        days: Math.abs(adj.amount),
        startDate: null,
        endDate: null,
        clDebit, plDebit, clCredit, plCredit,
        clBalance: clBal, plBalance: plBal,
        status: adj.adjustmentType,
        isOpening: false, isAdjustment: true, isClosing: false,
        workingDays,
      })
    }
  }

  entries.push({
    id: 'closing',
    date: new Date().toISOString(),
    type: 'CLOSING',
    description: 'Closing Balance (as of today)',
    days: null, startDate: null, endDate: null,
    clDebit: null, plDebit: null, clCredit: null, plCredit: null,
    clBalance: clBal, plBalance: plBal,
    status: null, isOpening: false, isAdjustment: false, isClosing: true,
  })

  // HR: all employees for dropdown
  let allUsers: any[] = []
  if (isHR) {
    allUsers = await prisma.user.findMany({
      select: { id: true, name: true, department: { select: { name: true } } },
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    })
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leave Ledger</h1>
        <p className="text-slate-500 text-sm mt-1">
          Accounting-style register — every CL &amp; PL transaction with running balance.
        </p>
      </div>
      <LedgerClient
        initialEntries={entries}
        initialUser={{
          id: user.id,
          name: user.name,
          department: user.department?.name || 'N/A',
          openingCl,
          openingPl,
        }}
        currentCl={user.balances.cl}
        currentPl={user.balances.pl}
        allUsers={allUsers}
        role={role}
        year={year}
        showClBalance={showClBalance}
      />
    </div>
  )
}
