import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    
    const startOfTomorrow = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 0, 0, 0, 0))
    const endOfTomorrow = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 23, 59, 59, 999))
    const tomorrowStr = startOfTomorrow.toISOString().split('T')[0]

    const requests = await prisma.leaveRequest.findMany({
      where: {
        status: { in: ['HR_APPROVED', 'L1_APPROVED'] },
        startDate: {
          gte: startOfTomorrow,
          lte: endOfTomorrow
        }
      },
      include: {
        user: true,
        approvedBy: true
      }
    })

    let count = 0
    for (const req of (requests || [])) {
      const approvedBy = req.approvedBy
      const user = req.user

      if (approvedBy?.email) {
        const managerEmail = (approvedBy.communicationEmail && approvedBy.communicationEmail !== 'noreply@yopmail.com')
          ? approvedBy.communicationEmail
          : approvedBy.email
        const employeeName = user?.name || 'Unknown'
        const subject = `Reminder: ${employeeName} is on leave tomorrow`
        const html = `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #0f172a; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear ${approvedBy.name},</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        This is an automated reminder that <strong>${employeeName}</strong> will be on leave starting tomorrow (${tomorrowStr}).
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">LEAVE DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Employee</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${employeeName}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Leave Type</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${req.type}</td>
        </tr>
        <tr>
          <td style="padding: 16px; color: #64748b; font-size: 14px;">Start Date</td>
          <td style="padding: 16px; color: #0f172a; font-size: 14px; font-weight: 600;">${tomorrowStr}</td>
        </tr>
      </table>
      <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 32px;">
        Please ensure that any necessary handovers have been completed.
      </p>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Best Regards,</div>
        <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">Leave Management System</div>
        <div style="color: #64748b;">Unique School India LLP</div>
      </div>
    </div>
  </div>
  <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px;">
    This is an automated notification. Please do not reply to this email.
  </div>
</div>
        `

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
