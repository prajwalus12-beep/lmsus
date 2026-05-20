import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { calculateMonthlyPLAccrual } from '@/lib/accrualEngine'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  const { month, year } = await req.json()
  const users = await prisma.user.findMany({ where: { status: 'ACTIVE' } })

  const results = []

  for (const user of users) {
    const calc = await calculateMonthlyPLAccrual(prisma, user.id, year, month)
    
    if (calc.accrued > 0) {
      // Create a manual adjustment for the accrual
      // effective date is end of month or start of next
      const accrualDate = new Date(year, month + 1, 1) // 1st of next month
      
      const adj = await prisma.leaveBalanceAdjustment.create({
        data: {
          userId: user.id,
          leaveType: 'PL',
          amount: calc.accrued,
          adjustmentType: 'MONTHLY_ACCRUAL',
          reason: `Monthly PL Accrual (${calc.workingDays} working days: ${calc.totalDays}d - ${calc.weekendsCount}w - ${calc.holidaysCount}h - ${calc.leaveDaysCount}l)`,
          effectiveYear: year,
          enteredBy: sessionUser.id,
          enteredByName: 'System (Auto)',
          createdAt: accrualDate
        }
      })

      // Update the user's actual balance
      await prisma.leaveBalance.update({
        where: { userId: user.id },
        data: {
          pl: { increment: calc.accrued },
          plAccrued: { increment: calc.accrued }
        }
      })

      results.push({ user: user.name, accrued: calc.accrued })
    }
  }

  return NextResponse.json({ success: true, results })
}
