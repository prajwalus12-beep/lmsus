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
  const { year, remarks } = body as { year: number, remarks?: string }

  if (!year) {
    return NextResponse.json({ error: 'Year is required' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check if year is already closed
      const existing = await tx.leaveYearClosure.findUnique({ where: { year } })
      if (existing) throw new Error(`Year ${year} is already closed.`)

      // 2. Fetch all active leave balances
      const balances = await tx.leaveBalance.findMany({
        include: { user: true }
      })

      const NEXT_YEAR = year + 1
      const MAX_PL_CARRY_FORWARD = 30 // Rule 47

      for (const balance of balances) {
        const currentPl = balance.pl
        const carryForwardPl = Math.min(currentPl, MAX_PL_CARRY_FORWARD)
        const expiredPl = Math.max(0, currentPl - MAX_PL_CARRY_FORWARD)

        // 3. Record Carry Forward History (Rule 47)
        await tx.carryForwardHistory.create({
          data: {
            userId: balance.userId,
            fromYear: year,
            toYear: NEXT_YEAR,
            leaveType: 'PL',
            carryForwardDays: carryForwardPl,
            expiredDays: expiredPl,
            maxCarryLimit: MAX_PL_CARRY_FORWARD,
            processedBy: sessionUser.id
          }
        })

        // 4. Update the LeaveBalance for the new year
        // We reset CL and SL (Rule 43: CL/SL lapse)
        // Opening CL is usually reset to the entitlement (e.g. 7 days)
        const CL_ENTITLEMENT = 7 // Should ideally come from SystemConfig

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            year: NEXT_YEAR,
            openingPl: carryForwardPl,
            openingCl: CL_ENTITLEMENT,
            openingComp: 0,
            pl: carryForwardPl,
            cl: CL_ENTITLEMENT,
            sl: 7, // Assuming 7 as standard SL reset
            comp: 0,
            plAccrued: 0,
            plUsed: 0,
            clUsed: 0,
            slUsed: 0,
            plCarryForward: carryForwardPl,
          }
        })

        // 5. Audit Log
        await tx.auditLog.create({
          data: {
            userId: sessionUser.id,
            action: 'YEAR_CLOSED',
            entity: 'LeaveYearClosure',
            entityId: String(year),
            metadata: JSON.stringify({
              userId: balance.userId,
              carriedForward: carryForwardPl,
              expired: expiredPl
            })
          }
        })
      }

      // 6. Mark the year as closed
      const closure = await tx.leaveYearClosure.create({
        data: {
          year,
          closedBy: sessionUser.id,
          status: 'CLOSED',
          remarks: remarks ?? '',
          carryForwardProcessed: true
        }
      })

      return closure
    })

    return NextResponse.json({ success: true, closure: result })
  } catch (error: any) {
    console.error('Closure Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
