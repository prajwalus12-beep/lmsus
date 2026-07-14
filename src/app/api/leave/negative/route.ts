import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
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
    
    // Fetch the negative leave tracking record
    const { data: record, error: fetchErr } = await supabaseAdmin
      .from('negative_leave_trackings')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !record) {
      return NextResponse.json({ error: fetchErr?.message || 'Negative leave tracking record not found' }, { status: 404 })
    }

    const updateData: any = {
      status,
      remarks: remarks || record.remarks,
      updated_at: systemDate.toISOString()
    }

    if (status === 'RECOVERED') {
      updateData.recovered_at = systemDate.toISOString()
    }

    const { data: updatedRecord, error: updateErr } = await supabaseAdmin
      .from('negative_leave_trackings')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (updateErr || !updatedRecord) {
      throw new Error(updateErr?.message || 'Failed to update negative leave tracking status')
    }

    // Log in Audit Logs
    try {
      await supabaseAdmin
        .from('audit_logs')
        .insert({
          user_id: sessionUser.id,
          action: 'NEGATIVE_LEAVE_SETTLED',
          entity: 'NegativeLeaveTracking',
          entity_id: id,
          new_value: status,
          old_value: record.status,
          metadata: JSON.stringify({ remarks }),
          created_at: systemDate.toISOString()
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
