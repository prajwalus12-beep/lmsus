const { PrismaClient } = require('@prisma/client');
const { startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } = require('date-fns');

const prisma = new PrismaClient();

// Mocking calculateRequestedDays for the script
function calculateRequestedDays(startDate, endDate, holidayDates, isSandwichEnabled, leaveType, isHalfDay = false) {
  if (isHalfDay) return { days: 0.5 };

  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let days = 0;
  let currentDate = new Date(start);

  const isWknd = (d) => d.getDay() === 0 || d.getDay() === 6;
  const applySandwich = leaveType === "CL" && isSandwichEnabled;

  while (currentDate <= end) {
    const ds = currentDate.toISOString().split('T')[0];
    const isW = isWknd(currentDate);
    const isH = holidayDates.has(ds);

    if (applySandwich) {
      days += 1;
    } else {
      if (!isW && !isH) {
        days += 1;
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { days };
}

async function syncLedger() {
  const year = 2026;
  const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
  const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

  const users = await prisma.user.findMany({
    include: { balances: true },
    where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } }
  });

  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: startOfYear, lte: endOfYear } }
  });
  const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

  const sandwichConfig = await prisma.systemConfig.findUnique({
    where: { key: 'weekend_sandwich_rule' }
  });
  const isSandwichEnabled = sandwichConfig?.value === 'true';

  await prisma.leaveLedgerEntry.deleteMany({});

  for (const user of users) {
    console.log(`Processing ledger for ${user.name}...`);
    if (!user.balances) continue;

    const openingCl = user.balances.openingCl;
    const openingPl = user.balances.openingPl;
    let clBal = openingCl;
    let plBal = openingPl;

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        userId: user.id,
        status: 'HR_APPROVED',
        startDate: { gte: startOfYear, lte: endOfYear },
      },
      orderBy: { startDate: 'asc' },
    });

    const adjustments = await prisma.leaveBalanceAdjustment.findMany({
      where: { userId: user.id, effectiveYear: year },
      orderBy: { createdAt: 'asc' },
    });

    // Add Opening Entry
    await prisma.leaveLedgerEntry.create({
      data: {
        userId: user.id,
        date: startOfYear,
        type: 'OPENING',
        description: `Opening Balance — 1 Jan ${year}`,
        clCredit: openingCl,
        plCredit: openingPl,
        clBalance: clBal,
        plBalance: plBal,
        isOpening: true,
      }
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
        else continue; // Skip other leave types for now as per current ledger logic

        await prisma.leaveLedgerEntry.create({
          data: {
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
          }
        });
      } else {
        const adj = ev.data;
        let clDebit = null;
        let clCredit = null;
        let plDebit = null;
        let plCredit = null;

        if (adj.leaveType === 'CL') {
          if (adj.amount < 0) { clDebit = Math.abs(adj.amount); }
          else { clCredit = adj.amount; }
          clBal += adj.amount;
        } else if (adj.leaveType === 'PL') {
          if (adj.amount < 0) { plDebit = Math.abs(adj.amount); }
          else { plCredit = adj.amount; }
          plBal += adj.amount;
        }

        await prisma.leaveLedgerEntry.create({
          data: {
            userId: user.id,
            date: adj.createdAt,
            type: adj.adjustmentType === 'MONTHLY_ACCRUAL' ? 'ACCRUAL' : `ADJ-${adj.leaveType}`,
            description: adj.reason,
            days: Math.abs(adj.amount),
            clDebit, clCredit, clBalance: clBal,
            plDebit, plCredit, plBalance: plBal,
            isAdjustment: true,
          }
        });
      }
    }

    // Add Closing Entry
    await prisma.leaveLedgerEntry.create({
      data: {
        userId: user.id,
        date: new Date(),
        type: 'CLOSING',
        description: 'Closing Balance (as of today)',
        clBalance: clBal,
        plBalance: plBal,
        isClosing: true,
      }
    });
  }

  console.log('Ledger sync completed.');
}

syncLedger()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
