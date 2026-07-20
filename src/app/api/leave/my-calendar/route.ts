import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  const requests = await prisma.leaveRequest.findMany({
    where: {
      userId: userId,
      status: { in: ['HR_APPROVED', 'L1_APPROVED'] }
    },
    include: {
      user: {
        include: { department: true }
      }
    }
  })

  const formatted = (requests || []).map((req: any) => {
    return {
      id: req.id,
      userId: req.userId,
      title: `${req.user?.name || 'Unknown'} - ${req.type}`,
      email: req.user?.email || '',
      startDate: req.startDate.toISOString(),
      endDate: req.endDate.toISOString(),
      department: req.user?.department?.name || 'N/A',
      type: req.type,
      status: req.status,
    }
  })

  return NextResponse.json({ requests: formatted, userId })
}
