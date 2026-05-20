import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { calculateRequestedDays } from "@/lib/leaveCalculator"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, type, startDate, endDate, isHalfDay } = body

    if (!userId || !startDate || !endDate || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    // 1. Fetch holidays and config in parallel
    const [holidays, sandwichConfig] = await Promise.all([
      prisma.holiday.findMany({
        where: { date: { gte: new Date(start.getFullYear(), 0, 1), lte: new Date(start.getFullYear(), 11, 31) } }
      }),
      prisma.systemConfig.findUnique({ where: { key: "weekend_sandwich_rule" } })
    ]);

    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))
    const isSandwichEnabled = sandwichConfig?.value === "true"

    // 2. Calculate days (Now FAST synchronous)
    const { days, convertedToPl } = calculateRequestedDays(
      start, 
      end, 
      holidayDates, 
      isSandwichEnabled, 
      type, 
      isHalfDay
    )

    // 3. Simple projection (Monthly PL accrual)
    const balance = await prisma.leaveBalance.findUnique({ where: { userId } })
    let projectedPl = balance?.pl || 0
    
    // Monthly accrual logic (Simplified for projection)
    const rateConfig = await prisma.systemConfig.findUnique({ where: { key: 'ACCRUAL_RATE_PL' } })
    const rate = parseFloat(rateConfig?.value || "1.5")
    
    const today = new Date()
    if (start > today) {
      const monthsDiff = (start.getFullYear() - today.getFullYear()) * 12 + (start.getMonth() - today.getMonth())
      if (monthsDiff > 0) projectedPl += (monthsDiff * rate)
    }

    return NextResponse.json({
      success: true,
      projectedBalance: { ...balance, projectedPl, projectedDate: startDate },
      days,
      convertedToPl
    })
  } catch (error) {
    console.error("Projection Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
