import { PrismaClient } from "@prisma/client"
import { startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, format } from "date-fns"

export async function calculateMonthlyPLAccrual(
  prisma: PrismaClient,
  userId: string,
  year: number,
  month: number // 0-indexed (0 = Jan, 11 = Dec)
) {
  const start = startOfMonth(new Date(year, month))
  const end = endOfMonth(new Date(year, month))

  // 1. Get total days in month
  const allDays = eachDayOfInterval({ start, end })
  const totalDays = allDays.length

  // 2. Fetch system configs
  const [rateConfig, baseConfig, thresholdConfig, includePaidLeave] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: 'ACCRUAL_RATE_PL' } }),
    prisma.systemConfig.findUnique({ where: { key: 'ACCRUAL_BASE_DAYS' } }),
    prisma.systemConfig.findUnique({ where: { key: 'MIN_WORKED_DAYS_FOR_PL' } }),
    prisma.systemConfig.findUnique({ where: { key: 'INCLUDE_PAID_LEAVE_IN_ACCRUAL' } })
  ])
  
  const rate = parseFloat(rateConfig?.value || "1.5")
  const baseDays = parseInt(baseConfig?.value || "20")
  const threshold = parseInt(thresholdConfig?.value || "15")
  const paidLeaveCounts = includePaidLeave?.value !== "false" // default true

  // 3. Calculate Deductions
  const weekendsCount = allDays.filter(d => isWeekend(d)).length
  
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: start, lte: end } }
  })
  const holidaysCount = holidays.length

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: 'HR_APPROVED',
      startDate: { lte: end },
      endDate: { gte: start },
    }
  })

  let leaveDaysCount = 0
  for (const req of leaveRequests) {
    const overlapStart = req.startDate < start ? start : req.startDate
    const overlapEnd = req.endDate > end ? end : req.endDate
    const diff = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    leaveDaysCount += diff
  }

  // 4. Calculate Final Working Days (Formula: Duration - Weekends - Holidays - Leaves)
  const workingDays = totalDays - weekendsCount - holidaysCount - leaveDaysCount
  const eligibleDays = workingDays // In this context, they are the same

  // 5. Check Threshold
  if (workingDays < threshold) {
    return {
      accrued: 0,
      totalDays,
      workingDays,
      weekendsCount,
      holidaysCount,
      leaveDaysCount,
      reason: `Working days (${workingDays}) below threshold (${threshold})`
    }
  }

  // 6. Calculate PL (Pro-rata based on working days vs base days)
  const accrued = baseDays > 0 ? (workingDays / baseDays) * rate : 0

  return {
    accrued: parseFloat(accrued.toFixed(2)),
    totalDays,
    eligibleDays,
    rate,
    threshold
  }
}
