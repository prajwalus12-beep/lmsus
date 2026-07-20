import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { syncUserLedger } from '@/lib/ledgerSync'
import prisma from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    console.log('--- SYSTEM RESET INITIATED BY ADMIN ---')

    // 1. Load seed data from JSON
    const dataPath = path.join(process.cwd(), 'data_backup.json')
    const fileContent = fs.readFileSync(dataPath, 'utf8')
    const seedData = JSON.parse(fileContent)

    if (!seedData.users || seedData.users.length === 0) {
      return NextResponse.json({ error: 'No seed data found in data_backup.json' }, { status: 400 })
    }

    const currentAdminId = session.user.id

    // 2. Clear all tables using Prisma (keeping the current admin so session is not invalidated)
    await prisma.auditLog.deleteMany()
    await prisma.leaveBalanceAdjustment.deleteMany()
    await prisma.leaveLedgerEntry.deleteMany()
    await prisma.leaveRequest.deleteMany()
    await prisma.compOffWorkEntry.deleteMany()
    await prisma.negativeLeaveTracking.deleteMany()
    await prisma.carryForwardHistory.deleteMany()
    await prisma.leaveYearClosure.deleteMany()
    await prisma.leaveBalance.deleteMany()
    await prisma.systemConfig.deleteMany()
    await prisma.holiday.deleteMany()
    
    // Delete all users except current logged in admin
    await prisma.user.deleteMany({
      where: {
        id: { not: currentAdminId }
      }
    })
    await prisma.department.deleteMany()

    // 3. Restore departments
    if (seedData.departments && seedData.departments.length > 0) {
      await prisma.department.createMany({
        data: seedData.departments.map((d: any) => ({
          id: d.id,
          name: d.name,
          createdAt: new Date(d.createdAt)
        }))
      })
    }

    // 4. Restore users
    const hashedPassword = bcrypt.hashSync("Unique@123", 12)
    const userIdMap: Record<string, string> = {}

    for (const u of seedData.users) {
      if (u.email === session.user.email) {
        // Update the current admin profile instead of creating it
        await prisma.user.update({
          where: { id: currentAdminId },
          data: {
            name: u.name,
            role: u.role,
            departmentId: u.departmentId || null,
            joinDate: new Date(u.joinDate),
            status: u.status,
            communicationEmail: u.communicationEmail,
            createdAt: new Date(u.createdAt)
          }
        })
        userIdMap[u.id] = currentAdminId
      } else {
        // Create new user in the DB
        const newUser = await prisma.user.create({
          data: {
            name: u.name,
            email: u.email.toLowerCase().trim(),
            password: hashedPassword,
            role: u.role,
            departmentId: u.departmentId || null,
            joinDate: new Date(u.joinDate),
            status: u.status,
            communicationEmail: u.communicationEmail,
            createdAt: new Date(u.createdAt)
          }
        })
        userIdMap[u.id] = newUser.id
      }
    }

    // 5. Restore leave balances
    const balancesToInsert = seedData.leaveBalances.map((b: any) => {
      const mappedUserId = userIdMap[b.userId]
      if (!mappedUserId) return null
      return {
        id: b.id,
        userId: mappedUserId,
        year: b.year,
        openingPl: b.openingPl || 0,
        openingCl: b.openingCl || 0,
        openingComp: b.openingComp || 0,
        pl: b.pl || 0,
        cl: b.cl || 0,
        sl: b.sl || 0,
        comp: b.comp || 0,
        plAccrued: b.plAccrued || 0,
        plUsed: b.plUsed || 0,
        clUsed: b.clUsed || 0,
        slUsed: b.slUsed || 0,
        createdAt: new Date(b.createdAt)
      }
    }).filter(Boolean) as any[]

    if (balancesToInsert.length > 0) {
      await prisma.leaveBalance.createMany({
        data: balancesToInsert
      })
    }

    // 6. Restore holidays
    if (seedData.holidays && seedData.holidays.length > 0) {
      for (const h of seedData.holidays) {
        await prisma.holiday.upsert({
          where: { id: h.id },
          update: { name: h.name, date: new Date(h.date) },
          create: { id: h.id, name: h.name, date: new Date(h.date), createdAt: new Date(h.createdAt) }
        })
      }
    }

    // 7. Restore configs
    if (seedData.systemConfigs && seedData.systemConfigs.length > 0) {
      await prisma.systemConfig.createMany({
        data: seedData.systemConfigs.map((c: any) => ({
          id: c.id,
          key: c.key,
          value: c.value,
          createdAt: new Date(c.createdAt)
        }))
      })
    }

    // Sync all user ledgers for 2026
    for (const newUid of Object.values(userIdMap)) {
      try {
        await syncUserLedger(newUid, 2026)
      } catch (syncErr: any) {
        console.error(`Failed to sync ledger for user ${newUid}:`, syncErr.message)
      }
    }

    // Log reset
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'SYSTEM_RESET',
        entity: 'System',
        metadata: JSON.stringify({ message: 'System restored to seed state via JSON backup' }),
        createdAt: new Date()
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'System reset to seed state successfully.' 
    })

  } catch (error: any) {
    console.error('Reset Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
