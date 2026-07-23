import { startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns"
import prisma from "./prisma"

export async function calculateMonthlyPLAccrual(
  userId: string,
  year: number,
  month: number, // 0-indexed (0 = Jan, 11 = Dec)
  tx?: any
) {
  const db = tx || prisma

  // 1. Fetch user to check joinDate and lastWorkingDay
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { joinDate: true, lastWorkingDay: true }
  })
  if (!user) {
    return { accrued: 0, reason: "User not found" }
  }

  const joinDate = new Date(user.joinDate)
  const lastWorkingDay = user.lastWorkingDay ? new Date(user.lastWorkingDay) : null

  // Target month boundaries (local time, matching startOfMonth/endOfMonth)
  const targetStart = startOfMonth(new Date(year, month))
  const targetEnd = endOfMonth(new Date(year, month))

  // If user joined after this month or left before this month, they accrue nothing
  if (joinDate > targetEnd) {
    return { accrued: 0, reason: "User joined after target month" }
  }
  if (lastWorkingDay && lastWorkingDay < targetStart) {
    return { accrued: 0, reason: "User left before target month" }
  }

  // Active calculation boundaries based on joining/resignation date
  const activeStart = joinDate > targetStart ? joinDate : targetStart
  const activeEnd = lastWorkingDay && lastWorkingDay < targetEnd ? lastWorkingDay : targetEnd

  // 1. Get total days in active range of month
  const allDays = eachDayOfInterval({ start: activeStart, end: activeEnd })
  const totalDays = allDays.length

  // 2. Fetch system configs using Prisma
  const [
    rateConfigPl,
    rateConfigPerMonth,
    baseConfig,
    thresholdConfig,
    minWorkingDaysThresholdConfig,
    includePaidLeave
  ] = await Promise.all([
    db.systemConfig.findUnique({ where: { key: 'ACCRUAL_RATE_PL' } }),
    db.systemConfig.findUnique({ where: { key: 'PL_ACCRUAL_PER_MONTH' } }),
    db.systemConfig.findUnique({ where: { key: 'ACCRUAL_BASE_DAYS' } }),
    db.systemConfig.findUnique({ where: { key: 'MIN_WORKED_DAYS_FOR_PL' } }),
    db.systemConfig.findUnique({ where: { key: 'min_working_days_threshold' } }),
    db.systemConfig.findUnique({ where: { key: 'INCLUDE_PAID_LEAVE_IN_ACCRUAL' } })
  ])
  
  const rate = parseFloat(rateConfigPl?.value || rateConfigPerMonth?.value || "1.5")
  const baseDays = parseInt(baseConfig?.value || "20")
  const threshold = parseInt(minWorkingDaysThresholdConfig?.value || thresholdConfig?.value || "5")

  // 3. Calculate Deductions within active range
  const weekendsCount = allDays.filter(d => isWeekend(d)).length
  
  const holidays = await db.holiday.findMany({
    where: {
      date: {
        gte: activeStart,
        lte: activeEnd
      }
    }
  })

  // Filter out holidays that fall on weekends to avoid double deduction
  const holidaysCount = holidays?.filter((h: any) => !isWeekend(h.date)).length || 0

  const leaveRequests = await db.leaveRequest.findMany({
    where: {
      userId,
      status: 'HR_APPROVED',
      startDate: { lte: activeEnd },
      endDate: { gte: activeStart }
    }
  })

  const toLocalDateString = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const holidayDates = new Set(holidays.map((h: any) => toLocalDateString(h.date)))
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
    const overlapStart = reqStart < activeStart ? activeStart : reqStart
    const overlapEnd = reqEnd > activeEnd ? activeEnd : reqEnd

    const current = new Date(overlapStart)
    while (current <= overlapEnd) {
      const isWknd = isWeekend(current)
      const isHol = holidayDates.has(toLocalDateString(current))

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
  // 1. Fetch user to check joinDate and lastWorkingDay
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { joinDate: true, lastWorkingDay: true }
  })
  if (!user || !user.joinDate) {
    return { accrued: 0, reason: "User or join date not found" }
  }

  const joinDate = new Date(user.joinDate)
  const lastWorkingDay = user.lastWorkingDay ? new Date(user.lastWorkingDay) : null

  // Use local date calculations to avoid timezone shifts
  const joinYear = joinDate.getFullYear()
  const joinMonth = joinDate.getMonth()
  const joiningDay = joinDate.getDate()

  const targetStartOfMonth = new Date(year, month, 1)
  const targetEndOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999)

  // If target month is before joining month, accrual is 0
  if (targetEndOfMonth < joinDate) {
    return { accrued: 0, reason: "Target month is before joining date" }
  }

  // If target month is after last working day, accrual is 0
  if (lastWorkingDay && targetStartOfMonth > lastWorkingDay) {
    return { accrued: 0, reason: "Target month is after resignation date" }
  }

  // 2. Fetch Annual CL Entitlement Config
  const clEntitlementConfig = await db.systemConfig.findUnique({
    where: { key: 'CL_ANNUAL_ENTITLEMENT' }
  })
  const annualEntitlement = clEntitlementConfig ? parseFloat(clEntitlementConfig.value) : 12

  const monthlyEntitlement = annualEntitlement / 12

  // 3. Proration for the month of joining and/or resignation
  let accrued = monthlyEntitlement
  let isProrated = false
  let daysServed = 0
  let daysInMonth = new Date(year, month + 1, 0).getDate()

  const isJoinMonth = (joinYear === year && joinMonth === month)
  const leaveYear = lastWorkingDay ? lastWorkingDay.getFullYear() : null
  const leaveMonth = lastWorkingDay ? lastWorkingDay.getMonth() : null
  const isLeaveMonth = (lastWorkingDay && leaveYear === year && leaveMonth === month)

  if (isJoinMonth || isLeaveMonth) {
    isProrated = true
    const startDay = isJoinMonth ? joiningDay : 1
    const endDay = isLeaveMonth ? lastWorkingDay.getDate() : daysInMonth
    daysServed = Math.max(0, endDay - startDay + 1)
    const proratedRatio = daysServed / daysInMonth
    accrued = proratedRatio * monthlyEntitlement
  }

  // 4. Max Annual Accrual check (including opening balance and adjustments)
  const leaveBalance = await db.leaveBalance.findUnique({
    where: {
      userId_year: {
        userId,
        year
      }
    },
    select: { openingCl: true }
  })
  const openingCl = leaveBalance?.openingCl || 0

  const clAdjustments = await db.leaveBalanceAdjustment.aggregate({
    _sum: { amount: true },
    where: {
      userId,
      leaveType: 'CL',
      effectiveYear: year
    }
  })
  const accruedSoFar = clAdjustments._sum.amount || 0
  const remainingLimit = Math.max(0, annualEntitlement - openingCl - accruedSoFar)
  
  if (remainingLimit <= 0) {
    return {
      accrued: 0,
      reason: `Annual CL entitlement cap (${annualEntitlement}) reached`,
      isProrated,
      daysServed,
      daysInMonth,
      annualEntitlement,
      monthlyEntitlement
    }
  }

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

