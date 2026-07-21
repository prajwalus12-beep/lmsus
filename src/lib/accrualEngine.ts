import { startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns"
import prisma from "./prisma"

export async function calculateMonthlyPLAccrual(
  userId: string,
  year: number,
  month: number, // 0-indexed (0 = Jan, 11 = Dec)
  tx?: any
) {
  const db = tx || prisma
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
    db.systemConfig.findUnique({ where: { key: 'ACCRUAL_RATE_PL' } }),
    db.systemConfig.findUnique({ where: { key: 'ACCRUAL_BASE_DAYS' } }),
    db.systemConfig.findUnique({ where: { key: 'MIN_WORKED_DAYS_FOR_PL' } }),
    db.systemConfig.findUnique({ where: { key: 'min_working_days_threshold' } }),
    db.systemConfig.findUnique({ where: { key: 'INCLUDE_PAID_LEAVE_IN_ACCRUAL' } })
  ])
  
  const rate = parseFloat(rateConfig?.value || "1.5")
  const baseDays = parseInt(baseConfig?.value || "20")
  const threshold = parseInt(minWorkingDaysThresholdConfig?.value || thresholdConfig?.value || "5")

  // 3. Calculate Deductions
  const weekendsCount = allDays.filter(d => isWeekend(d)).length
  
  const holidays = await db.holiday.findMany({
    where: {
      date: {
        gte: start,
        lte: end
      }
    }
  })

  const holidaysCount = holidays?.length || 0

  const leaveRequests = await db.leaveRequest.findMany({
    where: {
      userId,
      status: 'HR_APPROVED',
      startDate: { lte: end },
      endDate: { gte: start }
    }
  })

  const holidayDates = new Set(holidays.map((h: any) => h.date.toISOString().split('T')[0]))
  const includePaid = includePaidLeave?.value === 'true'

  let leaveDaysCount = 0
  for (const req of leaveRequests) {
    const isPaidLeave = req.type.toUpperCase() !== 'LOP'
    // If INCLUDE_PAID_LEAVE_IN_ACCRUAL is true, approved paid leaves count as worked days (do not subtract them)
    if (includePaid && isPaidLeave) {
      continue
    }

    const reqStart = new Date(req.startDate)
    const reqEnd = new Date(req.endDate)
    const overlapStart = reqStart < start ? start : reqStart
    const overlapEnd = reqEnd > end ? end : reqEnd

    const current = new Date(overlapStart)
    while (current <= overlapEnd) {
      const isWknd = isWeekend(current)
      const isHol = holidayDates.has(current.toISOString().split('T')[0])

      if (!isWknd && !isHol) {
        leaveDaysCount++
      }
      current.setDate(current.getDate() + 1)
    }
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
  month: number, // 0-indexed (0 = Jan, 11 = Dec)
  tx?: any
) {
  const db = tx || prisma
  // 1. Fetch user to check joinDate
  const user = await db.user.findUnique({
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
  const clEntitlementConfig = await db.systemConfig.findUnique({
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
  const clAccruals = await db.leaveBalanceAdjustment.aggregate({
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

