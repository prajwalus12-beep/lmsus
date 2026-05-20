import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    console.log('--- SYSTEM RESET INITIATED BY ADMIN ---')

    // 1. Fetch seed data
    const [seedDepts, seedUsers, seedBalances, seedHolidays, seedConfigs] = await Promise.all([
      prisma.seedDepartment.findMany(),
      prisma.seedUser.findMany(),
      prisma.seedLeaveBalance.findMany(),
      prisma.seedHoliday.findMany(),
      prisma.seedSystemConfig.findMany()
    ])

    if (seedUsers.length === 0) {
      return NextResponse.json({ error: 'No seed data found. Capture seed first.' }, { status: 400 })
    }

    // 2. Delete all live data in reverse dependency order
    await prisma.$transaction([
      prisma.auditLog.deleteMany(),
      prisma.leaveBalanceAdjustment.deleteMany(),
      prisma.leaveRequest.deleteMany(),
      prisma.compOffWorkEntry.deleteMany(),
      prisma.negativeLeaveTracking.deleteMany(),
      prisma.carryForwardHistory.deleteMany(),
      prisma.leaveYearClosure.deleteMany(),
      prisma.leaveBalance.deleteMany(),
      prisma.systemConfig.deleteMany(),
      prisma.holiday.deleteMany(),
      prisma.user.deleteMany(),
      prisma.department.deleteMany(),
      prisma.weekendConfig.deleteMany(),
      prisma.systemDateOverride.deleteMany()
    ])

    // 3. Restore from Seed
    // Note: Restore in dependency order
    await prisma.department.createMany({
      data: seedDepts.map(d => ({ id: d.id, name: d.name, createdAt: d.createdAt }))
    })

    await prisma.user.createMany({
      data: seedUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        password: u.password,
        departmentId: u.departmentId,
        joinDate: u.joinDate,
        status: u.status,
        communicationEmail: u.communicationEmail,
        createdAt: u.createdAt
      }))
    })

    await prisma.leaveBalance.createMany({
      data: seedBalances.map(b => ({
        id: b.id,
        userId: b.userId,
        year: b.year,
        openingPl: b.openingPl,
        openingCl: b.openingCl,
        openingComp: b.openingComp,
        pl: b.pl,
        cl: b.cl,
        sl: b.sl,
        comp: b.comp,
        plAccrued: b.plAccrued,
        plUsed: b.plUsed,
        clUsed: b.clUsed,
        slUsed: b.slUsed,
        createdAt: b.createdAt
      }))
    })

    await prisma.holiday.createMany({
      data: seedHolidays.map(h => ({
        id: h.id,
        date: h.date,
        name: h.name,
        type: h.type,
        createdAt: h.createdAt
      }))
    })

    await prisma.systemConfig.createMany({
      data: seedConfigs.map(c => ({
        id: c.id,
        key: c.key,
        value: c.value,
        createdAt: c.createdAt
      }))
    })

    // Log the reset itself in a new audit log (after restoration)
    await prisma.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: 'SYSTEM_RESET',
        entity: 'System',
        metadata: JSON.stringify({ message: 'System restored to seed state' })
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'System reset to seed state successfully. Logging out...' 
    })

  } catch (error: any) {
    console.error('Reset Error:', error)
    return NextResponse.json({ error: 'Reset failed: ' + error.message }, { status: 500 })
  }
}
