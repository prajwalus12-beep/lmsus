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

  let days = 0
  let currentDate = new Date(start)

  const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6
  const applySandwich = leaveType === "CL" && isSandwichEnabled

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

  return { days, convertedToPl: false } // Auto-convert logic moved to server actions
}
