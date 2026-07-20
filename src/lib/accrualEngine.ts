import { startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns"
import prisma from "./prisma"

export async function calculateMonthlyPLAccrual(
  userId: string,
  year: number,
  month: number // 0-indexed (0 = Jan, 11 = Dec)
) {
  const start = startOfMonth(new Date(year, month))
  const end = endOfMonth(new Date(year, month))

  // 1. Get total days in month
  const allDays = eachDayOfInterval({ start, end })
  const totalDays = allDays.length

  // 2. Fetch system configs using Prisma
  const [
    rateConfig,
    baseConfig,
    thresholdConfig,
    minWorkingDaysThresholdConfig,
    includePaidLeave
  ] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: 'ACCRUAL_RATE_PL' } }),
    prisma.systemConfig.findUnique({ where: { key: 'ACCRUAL_BASE_DAYS' } }),
    prisma.systemConfig.findUnique({ where: { key: 'MIN_WORKED_DAYS_FOR_PL' } }),
    prisma.systemConfig.findUnique({ where: { key: 'min_working_days_threshold' } }),
    prisma.systemConfig.findUnique({ where: { key: 'INCLUDE_PAID_LEAVE_IN_ACCRUAL' } })
  ])
  
  const rate = parseFloat(rateConfig?.value || "1.5")
  const baseDays = parseInt(baseConfig?.value || "20")
  const threshold = parseInt(minWorkingDaysThresholdConfig?.value || thresholdConfig?.value || "5")

  // 3. Calculate Deductions
  const weekendsCount = allDays.filter(d => isWeekend(d)).length
  
  const holidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: start,
        lte: end
      }
    }
  })

  const holidaysCount = holidays?.length || 0

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: 'HR_APPROVED',
      startDate: { lte: end },
      endDate: { gte: start }
    }
  })

  let leaveDaysCount = 0
  for (const req of leaveRequests) {
    const reqStart = new Date(req.startDate)
    const reqEnd = new Date(req.endDate)
    const overlapStart = reqStart < start ? start : reqStart
    const overlapEnd = reqEnd > end ? end : reqEnd
    const diff = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    leaveDaysCount += diff
  }

  // 4. Calculate Final Working Days (Formula: Duration - Weekends - Holidays - Leaves)
  const workingDays = totalDays - weekendsCount - holidaysCount - leaveDaysCount
  const eligibleDays = workingDays

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
    threshold,
    workingDays,
    weekendsCount,
    holidaysCount,
    leaveDaysCount
  }
}

export async function calculateMonthlyCLAccrual(
  userId: string,
  year: number,
  month: number // 0-indexed (0 = Jan, 11 = Dec)
) {
  // 1. Fetch user to check joinDate
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { joinDate: true }
  })
  if (!user || !user.joinDate) {
    return { accrued: 0, reason: "User or join date not found" }
  }

  const joinDate = new Date(user.joinDate)
  // Define target month boundaries in UTC to avoid time zone offsets shifting the date
  const targetStartOfMonth = new Date(Date.UTC(year, month, 1))
  const targetEndOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))

  // If target month is before joining month, accrual is 0
  if (targetEndOfMonth < joinDate) {
    return { accrued: 0, reason: "Target month is before joining date" }
  }

  // 2. Fetch Annual CL Entitlement Config
  const clEntitlementConfig = await prisma.systemConfig.findUnique({
    where: { key: 'CL_ANNUAL_ENTITLEMENT' }
  })
  const annualEntitlement = clEntitlementConfig ? parseFloat(clEntitlementConfig.value) : 12

  const monthlyEntitlement = annualEntitlement / 12

  // 3. Proration for the month of joining
  let accrued = monthlyEntitlement
  let isProrated = false
  let daysServed = 0
  let daysInMonth = 0

  const joinYear = joinDate.getUTCFullYear()
  const joinMonth = joinDate.getUTCMonth()

  if (joinYear === year && joinMonth === month) {
    isProrated = true
    daysInMonth = new Date(year, month + 1, 0).getDate()
    const joiningDay = joinDate.getUTCDate()
    daysServed = daysInMonth - joiningDay + 1
    const proratedRatio = daysServed / daysInMonth
    accrued = proratedRatio * monthlyEntitlement
  }

  // 4. Max Annual Accrual check
  // Sum up all MONTHLY_ACCRUAL adjustments for CL in this target year
  const clAccruals = await prisma.leaveBalanceAdjustment.aggregate({
    _sum: { amount: true },
    where: {
      userId,
      leaveType: 'CL',
      adjustmentType: 'MONTHLY_ACCRUAL',
      effectiveYear: year
    }
  })
  const accruedSoFar = clAccruals._sum.amount || 0
  const remainingLimit = Math.max(0, annualEntitlement - accruedSoFar)
  
  if (accrued > remainingLimit) {
    accrued = remainingLimit
  }

  return {
    accrued: parseFloat(accrued.toFixed(4)),
    isProrated,
    daysServed,
    daysInMonth,
    annualEntitlement,
    monthlyEntitlement
  }
}

