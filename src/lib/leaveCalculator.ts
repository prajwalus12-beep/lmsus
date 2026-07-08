/**
 * Calculates the number of leave days taking into account weekends and holidays.
 * This version is SYNCHRONOUS to prevent N+1 database queries in loops.
 */
export function calculateRequestedDays(
  startDate: Date,
  endDate: Date,
  holidayDates: Set<string>,
  isSandwichEnabled: boolean,
  leaveType: string,
  isHalfDay: boolean = false
) {
  if (isHalfDay) return { days: 0.5, convertedToPl: false }

  const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()))
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()))

  // Rule 37 Check: If CL and duration > 2 calendar days, convert to PL
  const calendarDuration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const effectiveType = (leaveType === "CL" && calendarDuration > 2) ? "PL" : leaveType
  const convertedToPl = (leaveType === "CL" && effectiveType === "PL")

  let days = 0
  let currentDate = new Date(start)

  const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6
  // Rule: Weekend/national holiday sandwich rule disabled for all leaves to count working days properly.
  const applySandwich = false

  while (currentDate <= end) {
    const ds = currentDate.toISOString().split('T')[0]
    const isWknd = isWeekend(currentDate)
    const isHol = holidayDates.has(ds)

    if (applySandwich) {
      // Under sandwich, every day in the range counts
      days += 1
    } else {
      // Otherwise, only working days count
      if (!isWknd && !isHol) {
        days += 1
      }
    }
    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
  }

  return { days, convertedToPl, effectiveType }
}
