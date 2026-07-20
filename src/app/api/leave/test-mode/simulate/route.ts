import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { getSystemDate } from '@/lib/systemDate'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  const { scenario } = await req.json()
  const systemDate = await getSystemDate()

  try {
    if (scenario === 'Probation Completion') {
      const users = await prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { name: true, joinDate: true, probationEndDate: true }
      })

      const completedUsers = []

      const config = await prisma.systemConfig.findUnique({
        where: { key: 'PROBATION_PERIOD_MONTHS' }
      })
      const probationMonths = parseInt(config?.value || '6')

      for (const u of users) {
        let probEnd = u.probationEndDate ? new Date(u.probationEndDate) : null
        if (!probEnd && u.joinDate) {
          probEnd = new Date(u.joinDate)
          probEnd.setMonth(probEnd.getMonth() + probationMonths)
        }

        if (probEnd && probEnd <= systemDate) {
          completedUsers.push(u.name)
        }
      }

      return NextResponse.json({
        success: true,
        message: completedUsers.length > 0 
          ? `Verified probation completion: ${completedUsers.join(', ')} successfully completed probation by simulated date.`
          : 'No active employees have completed probation as of this simulated date.'
      })
    }

    return NextResponse.json({ error: 'Unknown scenario' }, { status: 400 })
  } catch (error: any) {
    console.error('Simulation Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
