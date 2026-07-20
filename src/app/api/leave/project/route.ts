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
    if (start > end) {
      return NextResponse.json({ error: "Start date cannot be after end date." }, { status: 400 })
    }

    const yearStart = new Date(Date.UTC(start.getFullYear(), 0, 1))
    const yearEnd = new Date(Date.UTC(start.getFullYear(), 11, 31, 23, 59, 59, 999))

    // 1. Fetch holidays and config in parallel using Prisma
    const [holidays, sandwichConfig] = await Promise.all([
      prisma.holiday.findMany({
        where: {
          date: {
            gte: yearStart,
            lte: yearEnd
          }
        }
      }),
      prisma.systemConfig.findUnique({ where: { key: 'weekend_sandwich_rule' } })
    ]);

    const holidayDates = new Set((holidays || []).map((h: any) => h.date.toISOString().split('T')[0]))
    const isSandwichEnabled = sandwichConfig?.value === "true"

    // 2. Calculate days for current request
    const { days, convertedToPl } = calculateRequestedDays(
      start, 
      end, 
      holidayDates, 
      isSandwichEnabled, 
      type, 
      isHalfDay
    )

    // 3. Fetch balance, pending leaves, and accrual rate
    const [balance, pendingLeaves, rateConfig] = await Promise.all([
      prisma.leaveBalance.findFirst({
        where: {
          userId,
          year: start.getFullYear()
        }
      }),
      prisma.leaveRequest.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'L1_APPROVED'] },
          startDate: { gte: yearStart },
          endDate: { lte: yearEnd }
        }
      }),
      prisma.systemConfig.findUnique({ where: { key: 'ACCRUAL_RATE_PL' } })
    ])

    // Calculate pending days per type
    let pendingPl = 0
    let pendingCl = 0
    let pendingComp = 0

    for (const req of pendingLeaves) {
      const { days: pDays, effectiveType } = calculateRequestedDays(
        new Date(req.startDate),
        new Date(req.endDate),
        holidayDates,
        isSandwichEnabled,
        req.type,
        req.halfDay !== 'NONE'
      )
      const rawType = (effectiveType || req.type).toUpperCase()
      if (rawType === 'PL') {
        pendingPl += pDays
      } else if (rawType === 'CL' || rawType === 'SL') {
        pendingCl += pDays
      } else if (rawType === 'COMP') {
        pendingComp += pDays
      }
    }

    const basePl = (balance?.pl || 0) - pendingPl
    const baseCl = (balance?.cl || 0) - pendingCl
    const baseComp = (balance?.comp || 0) - pendingComp

    let projectedPl = basePl
    
    // Monthly accrual logic (Simplified for projection)
    const rate = parseFloat(rateConfig?.value || "1.5")
    
    const today = new Date()
    if (start > today) {
      const monthsDiff = (start.getFullYear() - today.getFullYear()) * 12 + (start.getMonth() - today.getMonth())
      if (monthsDiff > 0) projectedPl += (monthsDiff * rate)
    }

    const mappedBalance = balance ? {
      id: balance.id,
      user_id: balance.userId,
      year: balance.year,
      opening_pl: balance.openingPl,
      opening_cl: balance.openingCl,
      opening_comp: balance.openingComp,
      pl: basePl, // Deduct pending PL
      cl: baseCl, // Deduct pending CL
      sl: balance.sl,
      comp: baseComp, // Deduct pending Comp
      pl_accrued: balance.plAccrued,
      pl_used: balance.plUsed,
      cl_used: balance.clUsed,
      sl_used: balance.slUsed,
      pl_carry_forward: balance.plCarryForward
    } : null

    return NextResponse.json({
      success: true,
      projectedBalance: { ...mappedBalance, projectedPl, projectedDate: startDate },
      days,
      convertedToPl
    })
  } catch (error) {
    console.error("Projection Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
