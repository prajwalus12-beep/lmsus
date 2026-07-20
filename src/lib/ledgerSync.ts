import prisma from './prisma'
import { calculateRequestedDays } from './leaveCalculator'
import { getSystemDate } from './systemDate'

export async function syncUserLedger(userId: string, year: number = 2026) {
  const systemDate = await getSystemDate()
  const startOfYear = new Date(Date.UTC(year, 0, 1))
  const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))

  const [
    user,
    holidays,
    sandwichConfig
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        balances: {
          where: { year }
        }
      }
    }),
    prisma.holiday.findMany({
      where: {
        date: {
          gte: startOfYear,
          lte: endOfYear
        }
      }
    }),
    prisma.systemConfig.findUnique({ where: { key: 'weekend_sandwich_rule' } })
  ])

  if (!user) return
  const balance = user.balances[0]
  if (!balance) return

  const holidayDates = new Set(holidays.map((h: any) => h.date.toISOString().split('T')[0]))
  const isSandwichEnabled = sandwichConfig?.value === 'true'

  // Clear existing ledger entries for this user and year using Prisma
  await prisma.leaveLedgerEntry.deleteMany({
    where: {
      userId: user.id,
      date: {
        gte: startOfYear,
        lte: endOfYear
      }
    }
  })

  let clBal = balance.openingCl || 0
  let plBal = balance.openingPl || 0
  let compBal = balance.openingComp || 0
  
  let plAccrued = 0
  let plUsed = 0
  let clUsed = 0
  let slUsed = 0

  const [
    approvedLeaves,
    adjustments,
    compOffCredits
  ] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        userId: user.id,
        status: 'HR_APPROVED',
        startDate: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      orderBy: { startDate: 'asc' }
    }),
    prisma.leaveBalanceAdjustment.findMany({
      where: {
        userId: user.id,
        effectiveYear: year
      },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.compOffWorkEntry.findMany({
      where: {
        userId: user.id,
        status: 'APPROVED',
        dateWorked: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      orderBy: { dateWorked: 'asc' }
    })
  ])

  const ledgerEntries: any[] = []

  // Add Opening Entry
  ledgerEntries.push({
    userId: user.id,
    date: startOfYear,
    type: 'OPENING',
    description: `Opening Balance — 1 Jan ${year}`,
    clCredit: balance.openingCl || 0,
    plCredit: balance.openingPl || 0,
    clBalance: clBal,
    plBalance: plBal,
    isOpening: true,
    isAdjustment: false,
    isClosing: false,
    workingDays: 0
  })

  const events = [
    ...approvedLeaves.map((l: any) => ({ kind: 'leave' as const, date: new Date(l.startDate), data: l })),
    ...adjustments.map((a: any) => ({ kind: 'adj' as const, date: new Date(a.createdAt), data: a })),
    ...compOffCredits.map((c: any) => ({ kind: 'comp_credit' as const, date: new Date(c.dateWorked), data: c }))
  ].sort((a, b) => a.date.getTime() - b.date.getTime())

  for (const ev of events) {
    if (ev.kind === 'leave') {
      const leave = ev.data
      const { days, effectiveType } = calculateRequestedDays(
        new Date(leave.startDate),
        new Date(leave.endDate),
        holidayDates,
        isSandwichEnabled,
        leave.type,
        leave.halfDay !== 'NONE'
      )

      if (days === 0) continue

      let clDebit = null, plDebit = null
      if (effectiveType === 'CL') { clDebit = days; clBal -= days; clUsed += days; }
      else if (effectiveType === 'PL') { plDebit = days; plBal -= days; plUsed += days; }
      else if (effectiveType === 'SL') { clDebit = days; clBal -= days; slUsed += days; }
      else if (effectiveType === 'COMP') { compBal -= days; }
      else continue

      ledgerEntries.push({
        userId: user.id,
        date: leave.startDate,
        type: effectiveType,
        description: leave.reason,
        startDate: leave.startDate,
        endDate: leave.endDate,
        days,
        clDebit: clDebit,
        plDebit: plDebit,
        clBalance: clBal,
        plBalance: plBal,
        isOpening: false,
        isAdjustment: false,
        isClosing: false
      })
    } else if (ev.kind === 'comp_credit') {
      const credit = ev.data
      compBal += credit.daysCredited
      ledgerEntries.push({
        userId: user.id,
        date: credit.dateWorked,
        type: 'COMP_CREDIT',
        description: `Comp-Off Earned: ${credit.reason}`,
        days: credit.daysCredited,
        clBalance: clBal,
        plBalance: plBal,
        isOpening: false,
        isAdjustment: false,
        isClosing: false
      })
    } else {
      const adj = ev.data
      let clDebit = null, clCredit = null, plDebit = null, plCredit = null

      if (adj.leaveType === 'CL') {
        if (adj.amount < 0) { clDebit = Math.abs(adj.amount); clUsed += clDebit; }
        else { clCredit = adj.amount }
        clBal += adj.amount
      } else if (adj.leaveType === 'PL') {
        if (adj.amount < 0) { plDebit = Math.abs(adj.amount); plUsed += plDebit; }
        else { plCredit = adj.amount; if (adj.adjustmentType === 'MONTHLY_ACCRUAL') plAccrued += adj.amount; }
        plBal += adj.amount
      } else if (adj.leaveType === 'COMP') {
        compBal += adj.amount
      }

      let workingDays: number | null = null
      if (adj.leaveType === 'PL' && adj.adjustmentType === 'MONTHLY_ACCRUAL') {
        const match = adj.reason.match(/Monthly PL Accrual \((\d+)\s+working days/)
        if (match) {
          workingDays = parseInt(match[1])
        }
      }

      ledgerEntries.push({
        userId: user.id,
        date: adj.createdAt,
        type: adj.adjustmentType === 'MONTHLY_ACCRUAL' ? 'ACCRUAL' : `ADJ-${adj.leaveType}`,
        description: adj.reason,
        days: Math.abs(adj.amount),
        clDebit: clDebit,
        clCredit: clCredit,
        clBalance: clBal,
        plBalance: plBal,
        workingDays: workingDays,
        isOpening: false,
        isAdjustment: true,
        isClosing: false
      })
    }
  }

  // Add Closing Entry
  ledgerEntries.push({
    userId: user.id,
    date: systemDate,
    type: 'CLOSING',
    description: 'Closing Balance (as of today)',
    clBalance: clBal,
    plBalance: plBal,
    isOpening: false,
    isAdjustment: false,
    isClosing: true
  })

  // Insert ledger entries in bulk
  if (ledgerEntries.length > 0) {
    await prisma.leaveLedgerEntry.createMany({
      data: ledgerEntries
    })
  }

  // Update balances
  await prisma.leaveBalance.update({
    where: {
      userId_year: {
        userId: user.id,
        year: year
      }
    },
    data: {
      pl: plBal,
      cl: clBal,
      comp: compBal,
      plAccrued: plAccrued,
      plUsed: plUsed,
      clUsed: clUsed,
      slUsed: slUsed,
      updatedAt: systemDate
    }
  })
}
