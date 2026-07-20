import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import prisma from '@/lib/prisma'
import { getSystemDateTime } from '@/lib/systemDate'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  const body = await req.json()
  const { id, status, remarks } = body

  if (!id || !status) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (status !== 'RECOVERED' && status !== 'WRITTEN_OFF') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  try {
    const systemDate = await getSystemDateTime()
    
    // Fetch the negative leave tracking record using Prisma
    const record = await prisma.negativeLeaveTracking.findUnique({
      where: { id }
    })

    if (!record) {
      return NextResponse.json({ error: 'Negative leave tracking record not found' }, { status: 404 })
    }

    const updateData: any = {
      status,
      remarks: remarks || record.remarks,
      updatedAt: systemDate
    }

    if (status === 'RECOVERED') {
      updateData.recoveredAt = systemDate
    }

    const updatedRecord = await prisma.negativeLeaveTracking.update({
      where: { id },
      data: updateData
    })

    // Log in Audit Logs
    try {
      await prisma.auditLog.create({
        data: {
          userId: sessionUser.id,
          action: 'NEGATIVE_LEAVE_SETTLED',
          entity: 'NegativeLeaveTracking',
          entityId: id,
          newValue: status,
          oldValue: record.status,
          metadata: JSON.stringify({ remarks }),
          createdAt: systemDate
        }
      })
    } catch (logError) {
      console.error('Error logging audit for negative leave settlement:', logError)
    }

    return NextResponse.json({ success: true, record: updatedRecord })
  } catch (error: any) {
    console.error('Negative leave update error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
