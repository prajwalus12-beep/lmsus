import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { syncUserLedger } from '@/lib/ledgerSync'

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, openingPl, openingCl, openingComp } = await req.json()

  try {
    const updatedBalance = await prisma.leaveBalance.update({
      where: { userId },
      data: {
        openingPl,
        openingCl,
        openingComp,
      }
    })

    // Create an audit log for this manual balance adjustment
    await prisma.auditLog.create({
      data: {
        userId: sessionUser.id,
        action: 'OPENING_BALANCE_ADJUSTED',
        entity: 'LeaveBalance',
        entityId: updatedBalance.id,
        newValue: JSON.stringify({ openingPl, openingCl, openingComp }),
        metadata: `HR adjusted opening balances for user ${userId}`
      }
    })

    // Keep ledger in sync
    await syncUserLedger(userId, updatedBalance.year)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
