import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { sendEmail } from '@/lib/email'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    const requests = await prisma.leaveRequest.findMany({
      where: {
        status: { in: ['HR_APPROVED', 'L1_APPROVED'] },
        startDate: {
          gte: new Date(`${tomorrowStr}T00:00:00.000Z`),
          lt: new Date(`${tomorrowStr}T23:59:59.999Z`)
        }
      },
      include: {
        user: true,
        approvedBy: true
      }
    })

    let count = 0
    for (const req of requests) {
      if (req.approvedBy?.email) {
        const managerEmail = req.approvedBy.email
        const employeeName = req.user.name
        const subject = `Reminder: ${employeeName} is on leave tomorrow`
        const html = `<p>Hi ${req.approvedBy.name},</p>
  <p>This is a reminder that <strong>${employeeName}</strong> will be on leave tomorrow (${tomorrowStr}).</p>
  <p>Leave Type: ${req.type}</p>
  <p>Thanks,<br>LMS System</p>`

        await sendEmail({ to: managerEmail, subject, html })
        count++
      }
    }

    return NextResponse.json({ success: true, remindersSent: count, requestsFound: requests.length })
  } catch (error) {
    console.error('Error sending reminders:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
