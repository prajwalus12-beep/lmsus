import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const targetUserId = searchParams.get('userId') || (session.user as any).id
  const year = parseInt(searchParams.get('year') || '2026')

  try {
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`)
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`)

    const [user, balance, entries] = await Promise.all([
      prisma.user.findUnique({ 
        where: { id: targetUserId }, 
        include: { department: true } 
      }),
      prisma.leaveBalance.findFirst({ 
        where: { userId: targetUserId, year } 
      }),
      prisma.leaveLedgerEntry.findMany({
        where: { 
          userId: targetUserId, 
          date: { gte: startOfYear, lte: endOfYear } 
        },
        orderBy: [
          { date: 'asc' },
          { createdAt: 'asc' }
        ]
      })
    ]);

    if (!user || !balance) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

    return NextResponse.json({
      user: { 
        id: user.id, 
        name: user.name, 
        department: user.department?.name || 'N/A' 
      },
      balance: {
        openingCl: balance.openingCl,
        openingPl: balance.openingPl,
        currentCl: balance.cl,
        currentPl: balance.pl,
      },
      entries: entries.map(e => ({
        ...e,
        date: e.date.toISOString(),
        startDate: e.startDate?.toISOString() || null,
        endDate: e.endDate?.toISOString() || null,
      }))
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
