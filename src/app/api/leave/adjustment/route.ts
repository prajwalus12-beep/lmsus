import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { syncUserLedger } from '@/lib/ledgerSync'
import prisma from '@/lib/prisma'
import { getSystemDateTime } from '@/lib/systemDate'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
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
    const systemDate = await getSystemDateTime()
    const floatAmount = parseFloat(amount)
    const yearInt = parseInt(effectiveYear)

    // 1. Create the adjustment record
    const adjustment = await prisma.leaveBalanceAdjustment.create({
      data: {
        userId: userId,
        leaveType: leaveType,
        amount: floatAmount,
        adjustmentType: adjustmentType,
        reason: reason,
        effectiveYear: yearInt,
        enteredBy: sessionUser.id,
        enteredByName: sessionUser.name,
        createdAt: systemDate
      }
    })

    // 2. Fetch live balance
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_year: {
          userId,
          year: yearInt
        }
      }
    })

    if (!balance) throw new Error(`User balance record not found for year ${yearInt}`)

    const typeKey = leaveType.toLowerCase() // pl, cl, sl, comp
    const currentVal = (balance as any)[typeKey] || 0

    // 3. Update live balance
    await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        [typeKey]: currentVal + floatAmount,
        updatedAt: systemDate
      }
    })

    // 4. Create Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          userId: sessionUser.id,
          action: 'ADJUSTMENT_MADE',
          entity: 'LeaveBalanceAdjustment',
          entityId: adjustment.id,
          newValue: String(currentVal + floatAmount),
          oldValue: String(currentVal),
          metadata: JSON.stringify({ targetUserId: userId, leaveType, amount, reason }),
          createdAt: systemDate
        }
      })
    } catch (logError) {
      console.error("Error creating adjustment audit log:", logError)
    }

    // Keep ledger in sync
    await syncUserLedger(userId, yearInt)

    return NextResponse.json({ success: true, adjustment })
  } catch (error: any) {
    console.error('Adjustment Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
