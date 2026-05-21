import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { calculateRequestedDays } from '@/lib/leaveCalculator'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const year = 2026;
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

    const [users, holidays, sandwichConfig] = await Promise.all([
      prisma.user.findMany({
        include: { balances: true },
        where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] }, role: { not: 'ADMIN' } }
      }),
      prisma.holiday.findMany({
        where: { date: { gte: startOfYear, lte: endOfYear } }
      }),
      prisma.systemConfig.findUnique({ where: { key: 'weekend_sandwich_rule' } })
    ]);

    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));
    const isSandwichEnabled = sandwichConfig?.value === 'true';

    // Clear existing ledger for the year? Or just rebuild?
    // Let's clear and rebuild for these users to ensure consistency.
    const userIds = users.map(u => u.id);
    await prisma.leaveLedgerEntry.deleteMany({
      where: { userId: { in: userIds }, date: { gte: startOfYear, lte: endOfYear } }
    });

    for (const user of users) {
      if (!user.balances) continue;

      const openingCl = user.balances.openingCl;
      const openingPl = user.balances.openingPl;
      let clBal = openingCl;
      let plBal = openingPl;

      const [approvedLeaves, adjustments] = await Promise.all([
        prisma.leaveRequest.findMany({
          where: {
            userId: user.id,
            status: 'HR_APPROVED',
            startDate: { gte: startOfYear, lte: endOfYear },
          },
          orderBy: { startDate: 'asc' },
        }),
        prisma.leaveBalanceAdjustment.findMany({
          where: { userId: user.id, effectiveYear: year },
          orderBy: { createdAt: 'asc' },
        })
      ]);

      const ledgerEntries: any[] = [];

      // Add Opening Entry
      ledgerEntries.push({
        userId: user.id,
        date: startOfYear,
        type: 'OPENING',
        description: `Opening Balance — 1 Jan ${year}`,
        clCredit: openingCl,
        plCredit: openingPl,
        clBalance: clBal,
        plBalance: plBal,
        isOpening: true,
      });

      const events = [
        ...approvedLeaves.map(l => ({ kind: 'leave', date: l.startDate, data: l })),
        ...adjustments.map(a => ({ kind: 'adj', date: a.createdAt, data: a })),
      ].sort((a, b) => a.date.getTime() - b.date.getTime());

      for (const ev of events) {
        if (ev.kind === 'leave') {
          const leave = ev.data;
          const { days } = calculateRequestedDays(
            leave.startDate,
            leave.endDate,
            holidayDates,
            isSandwichEnabled,
            leave.type,
            leave.halfDay !== 'NONE'
          );

          let clDebit = null;
          let plDebit = null;
          if (leave.type === 'CL') { clDebit = days; clBal -= days; }
          else if (leave.type === 'PL') { plDebit = days; plBal -= days; }
          else continue;

          ledgerEntries.push({
            userId: user.id,
            date: leave.startDate,
            type: leave.type,
            description: leave.reason,
            startDate: leave.startDate,
            endDate: leave.endDate,
            days,
            clDebit,
            plDebit,
            clBalance: clBal,
            plBalance: plBal,
          });
        } else {
          const adj = ev.data;
          let clDebit = null, clCredit = null, plDebit = null, plCredit = null;

          if (adj.leaveType === 'CL') {
            if (adj.amount < 0) { clDebit = Math.abs(adj.amount); }
            else { clCredit = adj.amount; }
            clBal += adj.amount;
          } else if (adj.leaveType === 'PL') {
            if (adj.amount < 0) { plDebit = Math.abs(adj.amount); }
            else { plCredit = adj.amount; }
            plBal += adj.amount;
          }

          ledgerEntries.push({
            userId: user.id,
            date: adj.createdAt,
            type: adj.adjustmentType === 'MONTHLY_ACCRUAL' ? 'ACCRUAL' : `ADJ-${adj.leaveType}`,
            description: adj.reason,
            days: Math.abs(adj.amount),
            clDebit, clCredit, clBalance: clBal,
            plDebit, plCredit, plBalance: plBal,
            isAdjustment: true,
          });
        }
      }

      // Add Closing Entry
      ledgerEntries.push({
        userId: user.id,
        date: new Date(),
        type: 'CLOSING',
        description: 'Closing Balance (as of today)',
        clBalance: clBal,
        plBalance: plBal,
        isClosing: true,
      });

      await prisma.leaveLedgerEntry.createMany({ data: ledgerEntries });
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
