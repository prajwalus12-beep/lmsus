"use server"

import prisma from "@/lib/prisma"
import { getServerSession } from "@/lib/supabaseServer"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { calculateRequestedDays } from "@/lib/leaveCalculator"
import { syncUserLedger } from "@/lib/ledgerSync"
import { getSystemDateTime } from "@/lib/systemDate"

export async function approveRequest(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error("Unauthorized")

  const userRole = session.user.role
  const approverId = session.user.id
  const status = userRole === "ADMIN" ? "HR_APPROVED" : "L1_APPROVED"

  // Prevent overriding finalized requests
  const currentReq = await prisma.leaveRequest.findUnique({
    where: { id }
  })

  if (!currentReq) throw new Error("Leave request not found")
  if (currentReq.userId === approverId) {
    throw new Error("Cannot approve your own leave request.")
  }
  if (currentReq.status === "HR_APPROVED") {
    throw new Error("Cannot approve: Leave request is already HR Approved.")
  }
  if (currentReq.status === "REJECTED") {
    throw new Error("Cannot approve: Leave request is already Rejected.")
  }
  if (currentReq.status === "L1_APPROVED" && userRole !== "ADMIN") {
    throw new Error("Cannot approve: Leave request has already been approved by L1 manager.")
  }

  // Update request using Prisma
  const request = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status,
      approvedById: approverId,
      approvedAt: await getSystemDateTime()
    },
    include: {
      user: true
    }
  })

  // 1. Fetch holidays and config for the calculator
  const requestYear = new Date(request.startDate).getFullYear()
  const yearStart = new Date(Date.UTC(requestYear, 0, 1))
  const yearEnd = new Date(Date.UTC(requestYear, 11, 31, 23, 59, 59, 999))

  const [holidays, sandwichConfig] = await Promise.all([
    prisma.holiday.findMany({
      where: {
        date: {
          gte: yearStart,
          lte: yearEnd
        }
      }
    }),
    prisma.systemConfig.findUnique({ where: { key: 'weekend_sandwich_rule' } })
  ])

  const holidayDates = new Set(holidays.map((h: any) => h.date.toISOString().split('T')[0]))
  const isSandwichEnabled = sandwichConfig?.value === "true"

  // 2. Calculate days
  const { days, effectiveType } = calculateRequestedDays(
    new Date(request.startDate), 
    new Date(request.endDate), 
    holidayDates, 
    isSandwichEnabled, 
    request.type, 
    request.halfDay !== "NONE"
  )

  // If HR approved, we need to deduct from balance
  if (status === "HR_APPROVED") {
    const rawLeaveType = (effectiveType || request.type).toLowerCase() // Use effectiveType (Rule 37)
    const leaveType = rawLeaveType === "sl" ? "cl" : rawLeaveType

    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_year: {
          userId: request.userId,
          year: requestYear
        }
      }
    })

    if (balance) {
      const currentVal = (balance as any)[leaveType] || 0
      const currentUsed = (balance as any)[`${leaveType}Used`] || 0
      const newVal = currentVal - days

      const updateData: any = {
        [leaveType]: newVal,
        [`${leaveType}Used`]: currentUsed + days
      }

      if (rawLeaveType === "sl") {
        updateData.slUsed = (balance.slUsed || 0) + days
      }

      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: updateData
      })
      
      // Rule 45: Negative Leave Tracking
      if (newVal < 0) {
        const negativeDaysInThisRequest = currentVal > 0 ? Math.abs(newVal) : days

        await prisma.negativeLeaveTracking.create({
          data: {
            userId: request.userId,
            leaveRequestId: request.id,
            leaveType: request.type,
            negativeDays: negativeDaysInThisRequest,
            status: 'PENDING',
            remarks: `Automatic tracking from request ${request.id}`
          }
        })
      }

      // Keep ledger in sync
      await syncUserLedger(request.userId, requestYear)
    }
  }

  // Email logic
  const profile = request.user
  const username = profile?.email ? profile.email.split('@')[0] : (profile?.name ? profile.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') : 'noreply')
  const targetEmail = (profile?.communicationEmail && profile.communicationEmail !== 'noreply@yopmail.com') ? profile.communicationEmail : (profile?.email || `${username}@yopmail.com`)
  if (targetEmail) {
    const formattedStartDate = new Date(request.startDate).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
    const formattedEndDate = new Date(request.endDate).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
    const totalDaysStr = days % 1 === 0 ? String(days) : days.toFixed(1)
    const approverName = session.user.name || 'HR Administrator'

    const isL1 = status === "L1_APPROVED"
    const subject = isL1 ? `Leave Request Approved by Manager (Pending HR)` : `Leave Request Approved`
    const descriptionText = isL1 
      ? `Your leave request has been approved by your manager and is currently pending final HR approval.` 
      : `We are pleased to inform you that your recent leave request has been approved.`
    const badgeBg = isL1 ? "#dbeafe" : "#d1fae5"
    const badgeText = isL1 ? "#1e3a8a" : "#065f46"
    const badgeLabel = isL1 ? "approved by manager" : "approved"

    await sendEmail({
      to: targetEmail,
      subject,
      html: `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #0f9d58; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear ${profile?.name || 'Employee'},</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        ${descriptionText}
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">LEAVE DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Leave Type</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${request.type}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Duration</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${formattedStartDate} <span style="color: #94a3b8; font-weight: normal; margin: 0 4px;">to</span> ${formattedEndDate}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Status</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;"><span style="background-color: ${badgeBg}; color: ${badgeText}; padding: 4px 8px; border-radius: 4px;">${badgeLabel}</span></td>
        </tr>
        <tr>
          <td style="padding: 16px; color: #64748b; font-size: 14px;">Approved By</td>
          <td style="padding: 16px; color: #0f172a; font-size: 14px; font-weight: 600;">${approverName}</td>
        </tr>
      </table>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Best Regards,</div>
        <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">Human Resources Team</div>
        <div style="color: #64748b;">Unique School India LLP</div>
      </div>
    </div>
  </div>
  <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px;">
    This is an automated administrative notification. Please do not reply directly to this message.
  </div>
</div>
      `
    })
  }

  // Create Audit Log
  await prisma.auditLog.create({
    data: {
      userId: approverId,
      action: status === "HR_APPROVED" ? "LEAVE_HR_APPROVED" : "LEAVE_L1_APPROVED",
      entity: "LeaveRequest",
      entityId: id,
      metadata: JSON.stringify({ approverName: session.user.name, status }),
      createdAt: await getSystemDateTime()
    }
  })

  revalidatePath("/requests")
  return { success: true }
}

export async function rejectRequest(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error("Unauthorized")

  const approverId = session.user.id

  const currentReq = await prisma.leaveRequest.findUnique({
    where: { id }
  })

  if (!currentReq) throw new Error("Leave request not found")
  if (currentReq.userId === approverId) {
    throw new Error("Cannot reject your own leave request.")
  }
  if (currentReq.status === "HR_APPROVED" || currentReq.status === "REJECTED") {
    throw new Error(`Cannot reject: request is already ${currentReq.status.replace('_', ' ').toLowerCase()}`)
  }

  const request = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: approverId,
      approvedAt: await getSystemDateTime()
    },
    include: {
      user: true
    }
  })

  // Email Notification
  const profile = request.user
  const username = profile?.email ? profile.email.split('@')[0] : (profile?.name ? profile.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') : 'noreply')
  const targetEmail = (profile?.communicationEmail && profile.communicationEmail !== 'noreply@yopmail.com') ? profile.communicationEmail : (profile?.email || `${username}@yopmail.com`)
  if (targetEmail) {
    const formattedStartDate = new Date(request.startDate).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
    const formattedEndDate = new Date(request.endDate).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
    const approverName = session.user.name || 'HR Administrator'

    await sendEmail({
      to: targetEmail,
      subject: `Leave Request Rejected`,
      html: `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #ea4335; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear ${profile?.name || 'Employee'},</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        We regret to inform you that your leave request has been <span style="background-color: #fde8e8; color: #9b1c1c; padding: 4px 8px; border-radius: 4px; font-weight: 600;">rejected</span>.
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">REQUEST DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Leave Type</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${request.type}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Duration</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${formattedStartDate} <span style="color: #94a3b8; font-weight: normal; margin: 0 4px;">to</span> ${formattedEndDate}</td>
        </tr>
        <tr>
          <td style="padding: 16px; color: #64748b; font-size: 14px;">Rejected By</td>
          <td style="padding: 16px; color: #0f172a; font-size: 14px; font-weight: 600;">${approverName}</td>
        </tr>
      </table>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Best Regards,</div>
        <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">Human Resources Team</div>
        <div style="color: #64748b;">Unique School India LLP</div>
      </div>
    </div>
  </div>
</div>
      `
    })
  }

  // Create Audit Log
  await prisma.auditLog.create({
    data: {
      userId: approverId,
      action: "LEAVE_REJECTED",
      entity: "LeaveRequest",
      entityId: id,
      metadata: JSON.stringify({ approverName: session.user.name }),
      createdAt: await getSystemDateTime()
    }
  })

  // Sync ledger
  await syncUserLedger(request.userId, new Date(request.startDate).getFullYear())

  revalidatePath("/requests")
  return { success: true }
}

export async function approveCompOff(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error("Unauthorized")

  const approverId = session.user.id

  const entry = await prisma.compOffWorkEntry.findUnique({
    where: { id }
  })

  if (!entry) throw new Error("Comp-off entry not found")
  if (entry.userId === approverId) {
    throw new Error("Cannot approve your own comp-off entry.")
  }
  if (entry.status !== "PENDING") {
    throw new Error(`Cannot approve: entry is already ${entry.status.toLowerCase()}`)
  }

  const expiryDate = new Date(entry.dateWorked)
  expiryDate.setDate(expiryDate.getDate() + 90)

  const updatedEntry = await prisma.compOffWorkEntry.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: approverId,
      approvedAt: await getSystemDateTime(),
      expiryDate: expiryDate
    },
    include: {
      user: true
    }
  })

  const entryYear = new Date(entry.dateWorked).getFullYear()

  // Update Leave Balance using Prisma
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      userId_year: {
        userId: entry.userId,
        year: entryYear
      }
    }
  })

  if (!balance) throw new Error("Leave balance record not found for year " + entryYear)

  await prisma.leaveBalance.update({
    where: { id: balance.id },
    data: {
      comp: (balance.comp || 0) + entry.daysCredited
    }
  })

  // Fetch applicant profile
  const profile = updatedEntry.user
  const fallbackUsername = profile?.email ? profile.email.split('@')[0] : (profile?.name ? profile.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') : 'noreply')
  const targetEmail = (profile?.communicationEmail && profile.communicationEmail !== 'noreply@yopmail.com') ? profile.communicationEmail : (profile?.email || `${fallbackUsername}@yopmail.com`)
  const approverName = session.user.name || 'HR Administrator'

  const formattedDate = new Date(entry.dateWorked).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  await sendEmail({
    to: targetEmail,
    subject: `Comp-Off Log Approved`,
    html: `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #0f9d58; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear ${profile?.name || 'Employee'},</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        We are pleased to inform you that your logged Comp-Off has been <span style="background-color: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 4px; font-weight: 600;">approved</span>.
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">APPROVED COMP-OFF DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Date Worked</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Hours Worked</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${entry.hoursWorked} hrs</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Leave Credited</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${entry.daysCredited} Day Comp-Off</td>
        </tr>
        <tr>
          <td style="padding: 16px; color: #64748b; font-size: 14px;">Approved By</td>
          <td style="padding: 16px; color: #0f172a; font-size: 14px; font-weight: 600;">${approverName}</td>
        </tr>
      </table>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Best Regards,</div>
        <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">Human Resources Team</div>
        <div style="color: #64748b;">Unique School India LLP</div>
      </div>
    </div>
  </div>
</div>
    `
  })

  // Create Audit Log using Prisma
  await prisma.auditLog.create({
    data: {
      userId: approverId,
      action: "COMPOFF_APPROVED",
      entity: "CompOffWorkEntry",
      entityId: id,
      metadata: JSON.stringify({ approverName }),
      createdAt: await getSystemDateTime()
    }
  })

  // Keep ledger in sync
  await syncUserLedger(entry.userId, entryYear)

  revalidatePath("/requests")
  return { success: true }
}

export async function rejectCompOff(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error("Unauthorized")

  const approverId = session.user.id

  const entry = await prisma.compOffWorkEntry.findUnique({
    where: { id }
  })

  if (!entry) throw new Error("Comp-off entry not found")
  if (entry.userId === approverId) {
    throw new Error("Cannot reject your own comp-off entry.")
  }
  if (entry.status !== "PENDING") {
    throw new Error(`Cannot reject: entry is already ${entry.status.toLowerCase()}`)
  }

  const updatedEntry = await prisma.compOffWorkEntry.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: approverId,
      approvedAt: await getSystemDateTime()
    },
    include: {
      user: true
    }
  })

  // Fetch applicant profile
  const profile = updatedEntry.user
  const fallbackUsername = profile?.email ? profile.email.split('@')[0] : (profile?.name ? profile.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') : 'noreply')
  const targetEmail = (profile?.communicationEmail && profile.communicationEmail !== 'noreply@yopmail.com') ? profile.communicationEmail : (profile?.email || `${fallbackUsername}@yopmail.com`)
  const approverName = session.user.name || 'HR Administrator'

  const formattedDate = new Date(entry.dateWorked).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  await sendEmail({
    to: targetEmail,
    subject: `Comp-Off Log Rejected`,
    html: `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #ea4335; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear ${profile?.name || 'Employee'},</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        We regret to inform you that your logged Comp-Off has been <span style="background-color: #fde8e8; color: #9b1c1c; padding: 4px 8px; border-radius: 4px; font-weight: 600;">rejected</span>.
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">COMP-OFF DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Date Worked</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Hours Logged</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${entry.hoursWorked} hrs</td>
        </tr>
        <tr>
          <td style="padding: 16px; color: #64748b; font-size: 14px;">Rejected By</td>
          <td style="padding: 16px; color: #0f172a; font-size: 14px; font-weight: 600;">${approverName}</td>
        </tr>
      </table>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Best Regards,</div>
        <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">Human Resources Team</div>
        <div style="color: #64748b;">Unique School India LLP</div>
      </div>
    </div>
  </div>
</div>
    `
  })

  // Create Audit Log using Prisma
  await prisma.auditLog.create({
    data: {
      userId: approverId,
      action: "COMPOFF_REJECTED",
      entity: "CompOffWorkEntry",
      entityId: id,
      metadata: JSON.stringify({ approverName }),
      createdAt: await getSystemDateTime()
    }
  })

  revalidatePath("/requests")
  return { success: true }
}
