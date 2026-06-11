import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { sendEmail } from '@/lib/email'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    const supabase = await getSupabaseServer()

    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select('*, profiles!leave_requests_user_id_fkey(*), approved_by:profiles!leave_requests_approved_by_id_fkey(*)')
      .in('status', ['HR_APPROVED', 'L1_APPROVED'])
      .gte('start_date', `${tomorrowStr}T00:00:00.000Z`)
      .lte('start_date', `${tomorrowStr}T23:59:59.999Z`)

    if (error) throw new Error(error.message)

    let count = 0
    for (const req of (requests || [])) {
      const approvedBy = req.approved_by
      const user = req.profiles

      if (approvedBy?.email) {
        const managerEmail = approvedBy.email
        const employeeName = user?.name || 'Unknown'
        const subject = `Reminder: ${employeeName} is on leave tomorrow`
        const html = `<p>Hi ${approvedBy.name},</p>
  <p>This is a reminder that <strong>${employeeName}</strong> will be on leave tomorrow (${tomorrowStr}).</p>
  <p>Leave Type: ${req.type}</p>
  <p>Thanks,<br>LMS System</p>`

        await sendEmail({ to: managerEmail, subject, html })
        count++
      }
    }

    return NextResponse.json({ success: true, remindersSent: count, requestsFound: requests?.length || 0 })
  } catch (error: any) {
    console.error('Error sending reminders:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
