import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  const body = await req.json()
  const { userId, leaveType, amount, adjustmentType, reason, effectiveYear } = body

  if (!userId || !leaveType || amount === undefined || !adjustmentType || !reason || !effectiveYear) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the adjustment record
      const adjustment = await tx.leaveBalanceAdjustment.create({
        data: {
          userId,
          leaveType,
          amount: parseFloat(amount),
          adjustmentType,
          reason,
          effectiveYear: parseInt(effectiveYear),
          enteredBy: sessionUser.id,
          enteredByName: sessionUser.name,
        },
      })

      // 2. Update the live balance
      const balance = await tx.leaveBalance.findUnique({ where: { userId } })
      if (!balance) throw new Error('User balance record not found')

      const typeKey = leaveType.toLowerCase() // pl, cl, sl, comp
      const currentVal = (balance as any)[typeKey] || 0

      await tx.leaveBalance.update({
        where: { userId },
        data: {
          [typeKey]: currentVal + parseFloat(amount),
        },
      })

      // 3. Create Audit Log
      await tx.auditLog.create({
        data: {
          userId: sessionUser.id,
          action: 'ADJUSTMENT_MADE',
          entity: 'LeaveBalanceAdjustment',
          entityId: adjustment.id,
          newValue: String(currentVal + parseFloat(amount)),
          oldValue: String(currentVal),
          metadata: JSON.stringify({ targetUserId: userId, leaveType, amount, reason }),
        },
      })

      return adjustment
    })

    return NextResponse.json({ success: true, adjustment: result })
  } catch (error: any) {
    console.error('Adjustment Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
