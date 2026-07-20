import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { syncUserLedger } from '@/lib/ledgerSync'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN' && sessionUser.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    const users = await prisma.user.findMany({
      where: {
        status: { in: ['ACTIVE', 'NOTICE_PERIOD'] }
      },
      select: { id: true }
    })

    for (const user of (users || [])) {
      await syncUserLedger(user.id, year)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
