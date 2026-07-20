import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { syncUserLedger } from '@/lib/ledgerSync'
import { getSystemDate, getSystemDateTime } from '@/lib/systemDate'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  const body = await req.json()
  const { year, remarks } = body as { year: number, remarks?: string }

  if (!year) {
    return NextResponse.json({ error: 'Year is required' }, { status: 400 })
  }

  const systemDate = await getSystemDate()

  try {
    // 1. Check if year is already closed
    const existing = await prisma.leaveYearClosure.findFirst({
      where: { year }
    })

    if (existing) {
      return NextResponse.json({ error: `Year ${year} is already closed.` }, { status: 400 })
    }

    // 2. Fetch all active leave balances
    const balances = await prisma.leaveBalance.findMany({
      where: { year }
    })

    const maxCfConfig = await prisma.systemConfig.findUnique({
      where: { key: 'MAX_CARRY_FORWARD_PL' }
    })

    const NEXT_YEAR = year + 1
    const MAX_PL_CARRY_FORWARD = maxCfConfig ? parseFloat(maxCfConfig.value) : 30 // Rule 47
    const CL_ENTITLEMENT = 7 // Standard CL Entitlement

    const carryForwardHistoryInserts = []
    const auditLogInserts = []
    const sysDateTime = await getSystemDateTime()

    for (const balance of (balances || [])) {
      const currentPl = balance.pl || 0
      const carryForwardPl = Math.min(currentPl, MAX_PL_CARRY_FORWARD)
      const expiredPl = Math.max(0, currentPl - MAX_PL_CARRY_FORWARD)

      // 3. Record Carry Forward History (Rule 47)
      carryForwardHistoryInserts.push({
        userId: balance.userId,
        fromYear: year,
        toYear: NEXT_YEAR,
        leaveType: 'PL',
        carryForwardDays: carryForwardPl,
        expiredDays: expiredPl,
        maxCarryLimit: MAX_PL_CARRY_FORWARD,
        processedBy: sessionUser.id,
        processedAt: sysDateTime
      })

      // 4. Create the new LeaveBalance for the new year
      await prisma.leaveBalance.create({
        data: {
          userId: balance.userId,
          year: NEXT_YEAR,
          openingPl: carryForwardPl,
          openingCl: 0,
          openingComp: 0,
          pl: carryForwardPl,
          cl: 0,
          sl: 0, // Reset SL to 0
          comp: 0,
          plAccrued: 0,
          plUsed: 0,
          clUsed: 0,
          slUsed: 0,
          plCarryForward: carryForwardPl,
          updatedAt: sysDateTime
        }
      })

      // Sync the new year's ledger entries (opening balance, etc.)
      try {
        await syncUserLedger(balance.userId, NEXT_YEAR)
      } catch (syncErr: any) {
        console.error(`Failed to sync initial ledger for user ${balance.userId} in ${NEXT_YEAR}:`, syncErr.message)
      }

      // 5. Prep Audit Log
      auditLogInserts.push({
        userId: sessionUser.id,
        action: 'YEAR_CLOSED',
        entity: 'LeaveYearClosure',
        entityId: String(year),
        metadata: JSON.stringify({
          userId: balance.userId,
          carriedForward: carryForwardPl,
          expired: expiredPl
        }),
        createdAt: sysDateTime
      })
    }

    if (carryForwardHistoryInserts.length > 0) {
      await prisma.carryForwardHistory.createMany({
        data: carryForwardHistoryInserts
      })
    }

    if (auditLogInserts.length > 0) {
      await prisma.auditLog.createMany({
        data: auditLogInserts
      })
    }

    const closure = await prisma.leaveYearClosure.create({
      data: {
        year,
        closedBy: sessionUser.id,
        status: 'CLOSED',
        remarks: remarks ?? '',
        carryForwardProcessed: true,
        closedAt: sysDateTime,
        createdAt: sysDateTime
      }
    })

    return NextResponse.json({ success: true, closure })
  } catch (error: any) {
    console.error('Closure Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
