import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { syncUserLedger } from '@/lib/ledgerSync'
import { getSystemDateTime } from '@/lib/systemDate'
import prisma from '@/lib/prisma'

export async function PUT(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, openingPl, openingCl, openingComp } = await req.json()
  const systemDate = await getSystemDateTime()

  try {
    const currentYear = systemDate.getFullYear()
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_year: {
          userId,
          year: currentYear
        }
      }
    })

    if (!balance) {
      throw new Error(`Leave balance record not found for user ${userId} and year ${currentYear}`)
    }

    const updatedBalance = await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        openingPl,
        openingCl,
        openingComp,
        updatedAt: systemDate
      }
    })

    // Create an audit log for this manual balance adjustment
    try {
      await prisma.auditLog.create({
        data: {
          userId: sessionUser.id,
          action: 'OPENING_BALANCE_ADJUSTED',
          entity: 'LeaveBalance',
          entityId: updatedBalance.id,
          newValue: JSON.stringify({ openingPl, openingCl, openingComp }),
          metadata: `HR adjusted opening balances for user ${userId}`,
          createdAt: systemDate
        }
      })
    } catch (auditError) {
      console.error("Error creating audit log:", auditError)
    }

    // Keep ledger in sync
    await syncUserLedger(userId, updatedBalance.year)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
