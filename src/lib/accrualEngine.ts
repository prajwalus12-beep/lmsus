import { startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns"

export async function calculateMonthlyPLAccrual(
  supabase: any,
  userId: string,
  year: number,
  month: number // 0-indexed (0 = Jan, 11 = Dec)
) {
  const start = startOfMonth(new Date(year, month))
  const end = endOfMonth(new Date(year, month))
  const startStr = start.toISOString()
  const endStr = end.toISOString()

  // 1. Get total days in month
  const allDays = eachDayOfInterval({ start, end })
  const totalDays = allDays.length

  // 2. Fetch system configs
  const [
    { data: rateConfig },
    { data: baseConfig },
    { data: thresholdConfig },
    { data: minWorkingDaysThresholdConfig },
    { data: includePaidLeave }
  ] = await Promise.all([
    supabase.from('system_configs').select('value').eq('key', 'ACCRUAL_RATE_PL').maybeSingle(),
    supabase.from('system_configs').select('value').eq('key', 'ACCRUAL_BASE_DAYS').maybeSingle(),
    supabase.from('system_configs').select('value').eq('key', 'MIN_WORKED_DAYS_FOR_PL').maybeSingle(),
    supabase.from('system_configs').select('value').eq('key', 'min_working_days_threshold').maybeSingle(),
    supabase.from('system_configs').select('value').eq('key', 'INCLUDE_PAID_LEAVE_IN_ACCRUAL').maybeSingle()
  ])
  
  const rate = parseFloat(rateConfig?.value || "1.5")
  const baseDays = parseInt(baseConfig?.value || "20")
  // Fetch min_working_days_threshold dynamic variable, fallback to MIN_WORKED_DAYS_FOR_PL, then default to 5
  const threshold = parseInt(minWorkingDaysThresholdConfig?.value || thresholdConfig?.value || "5")

  // 3. Calculate Deductions
  const weekendsCount = allDays.filter(d => isWeekend(d)).length
  
  const { data: holidays } = await supabase
    .from('holidays')
    .select('*')
    .gte('date', startStr)
    .lte('date', endStr)

  const holidaysCount = holidays?.length || 0

  const { data: leaveRequests } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'HR_APPROVED')
    .lte('start_date', endStr)
    .gte('end_date', startStr)

  let leaveDaysCount = 0
  for (const req of (leaveRequests || [])) {
    const reqStart = new Date(req.start_date)
    const reqEnd = new Date(req.end_date)
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
    threshold
  }
}
