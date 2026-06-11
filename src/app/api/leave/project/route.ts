import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabaseServer"
import { calculateRequestedDays } from "@/lib/leaveCalculator"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, type, startDate, endDate, isHalfDay } = body

    if (!userId || !startDate || !endDate || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await getSupabaseServer()
    const start = new Date(startDate)
    const end = new Date(endDate)

    const yearStart = `${start.getFullYear()}-01-01`
    const yearEnd = `${start.getFullYear()}-12-31`

    // 1. Fetch holidays and config in parallel
    const [{ data: holidays }, { data: sandwichConfig }] = await Promise.all([
      supabase.from('holidays').select('*').gte('date', yearStart).lte('date', yearEnd),
      supabase.from('system_configs').select('value').eq('key', 'weekend_sandwich_rule').single()
    ]);

    const holidayDates = new Set((holidays || []).map((h: any) => h.date.split('T')[0]))
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
    const { data: balance } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', userId)
      .single()

    let projectedPl = balance?.pl || 0
    
    // Monthly accrual logic (Simplified for projection)
    const { data: rateConfig } = await supabase
      .from('system_configs')
      .select('value')
      .eq('key', 'ACCRUAL_RATE_PL')
      .single()

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
