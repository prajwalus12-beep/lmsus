import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { syncUserLedger } from '@/lib/ledgerSync'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const targetUserId = searchParams.get('userId') || session.user.id
  const year = parseInt(searchParams.get('year') || '2026')

  try {
    const startOfYear = new Date(Date.UTC(year, 0, 1))
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))

    const [user, balance, entries] = await Promise.all([
      prisma.user.findUnique({
        where: { id: targetUserId },
        include: { department: true }
      }),
      prisma.leaveBalance.findUnique({
        where: {
          userId_year: {
            userId: targetUserId,
            year: year
          }
        }
      }),
      prisma.leaveLedgerEntry.findMany({
        where: {
          userId: targetUserId,
          date: {
            gte: startOfYear,
            lte: endOfYear
          }
        },
        orderBy: [
          { date: 'asc' },
          { createdAt: 'asc' }
        ]
      })
    ])

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (!balance) return NextResponse.json({ error: 'Balance not found' }, { status: 404 })

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
      entries: (entries || []).map((e: any) => ({
        id: e.id,
        userId: e.userId,
        date: e.date.toISOString(),
        type: e.type,
        description: e.description,
        startDate: e.startDate ? e.startDate.toISOString() : null,
        endDate: e.endDate ? e.endDate.toISOString() : null,
        days: e.days,
        clDebit: e.clDebit,
        clCredit: e.clCredit,
        clBalance: e.clBalance,
        plDebit: e.plDebit,
        plCredit: e.plCredit,
        plBalance: e.plBalance,
        compBalance: e.compBalance,
        workingDays: e.workingDays,
        isOpening: e.isOpening,
        isAdjustment: e.isAdjustment,
        isClosing: e.isClosing,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString()
      }))
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
