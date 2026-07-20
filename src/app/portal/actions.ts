"use server"

import prisma from "@/lib/prisma"
import { getServerSession } from "@/lib/supabaseServer"
import { revalidatePath } from "next/cache"
import { calculateRequestedDays } from "@/lib/leaveCalculator"
import { sendEmail } from "@/lib/email"
import { getSystemDate, getSystemDateTime } from "@/lib/systemDate"

function validateAttachmentUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:") return false;

    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    const isWhitelisted = 
      hostname === "drive.google.com" ||
      hostname === "dropbox.com" ||
      hostname.endsWith(".dropbox.com") ||
      hostname === "sharepoint.com" ||
      hostname.endsWith(".sharepoint.com") ||
      hostname === "company.com" ||
      hostname.endsWith(".company.com");

    if (!isWhitelisted) return false;

    if (hostname.includes("google.com") && (pathname.startsWith("/search") || pathname === "/")) {
      return false;
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

export async function submitLeaveRequest(data: {
  userId: string
  type: string
  startDate: string
  endDate: string
  reason: string
  isNegative: boolean
  negativeAmount: number
  attachmentUrl?: string
  halfDay?: string
}) {
  try {
    let { userId, type, startDate, endDate, reason, isNegative, negativeAmount, attachmentUrl, halfDay = "NONE" } = data
  
    // Verify session is active and check permissions
    const session = await getServerSession()
    if (!session) {
      throw new Error("Unauthorized: Not logged in.")
    }

    if (session.user.id !== userId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })

      const isAuthorized = currentUser && ['ADMIN', 'MANAGER'].includes(currentUser.role)
      if (!isAuthorized) {
        throw new Error("Unauthorized: You do not have permission to submit leave requests on behalf of other employees.")
      }
    }

    const parseAsUTCDate = (dateStr: string | Date) => {
      if (dateStr instanceof Date) return dateStr
      const isoStr = typeof dateStr === 'string' ? dateStr.split('T')[0] : ''
      const [y, m, d] = isoStr.split('-').map(Number)
      return new Date(Date.UTC(y, m - 1, d))
    }

    const startObj = parseAsUTCDate(startDate)
    const endObj = parseAsUTCDate(endDate)
    if (startObj > endObj) {
      throw new Error("Start date cannot be after end date.")
    }
    const leaveYear = startObj.getUTCFullYear()

    const yearStart = new Date(Date.UTC(leaveYear, 0, 1))
    const yearEnd = new Date(Date.UTC(leaveYear, 11, 31, 23, 59, 59, 999))

    // Query dependencies using Prisma
    const [
      user,
      holidays,
      sandwichConfig,
      probationConfig,
      maxNegativeConfig,
      existingLeaves,
      balance,
      maternityConfig,
      paternityConfig
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { department: true }
      }),
      prisma.holiday.findMany({
        where: {
          date: {
            gte: yearStart,
            lte: yearEnd
          }
        }
      }),
      prisma.systemConfig.findUnique({ where: { key: 'weekend_sandwich_rule' } }),
      prisma.systemConfig.findUnique({ where: { key: 'PROBATION_PERIOD_MONTHS' } }),
      prisma.systemConfig.findFirst({ where: { key: { in: ['MAX_NEGATIVE_LEAVE', 'MAX_NEGATIVE_BALANCE_ALLOWED'] } } }),
      prisma.leaveRequest.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'L1_APPROVED', 'HR_APPROVED'] },
          startDate: { gte: yearStart },
          endDate: { lte: yearEnd }
        }
      }),
      prisma.leaveBalance.findUnique({
        where: {
          userId_year: {
            userId,
            year: leaveYear
          }
        }
      }),
      prisma.systemConfig.findUnique({ where: { key: 'maternity_statutory_cap_days' } }),
      prisma.systemConfig.findUnique({ where: { key: 'paternity_corporate_cap_days' } })
    ])

    if (!user) throw new Error("User profile not found.")

    const isSandwichEnabled = sandwichConfig?.value === 'true'
    const probationMonths = parseInt(probationConfig?.value || "6")
    const maxNegativeLimit = parseFloat(maxNegativeConfig?.value || "-5")
    const matCap = parseInt(maternityConfig?.value || "182")
    const patCap = parseInt(paternityConfig?.value || "14")

    // Validation checks
    const holidayDates = new Set(holidays.map((h: any) => h.date.toISOString().split('T')[0]))
    const { days, effectiveType } = calculateRequestedDays(startObj, endObj, holidayDates, isSandwichEnabled, type, halfDay !== 'NONE')

    if (days <= 0) {
      throw new Error("Calculated leave duration is 0 days (e.g., all weekends/holidays).")
    }

    // Calculate pending request days for this user
    let pendingPl = 0
    let pendingCl = 0
    let pendingComp = 0

    for (const req of existingLeaves) {
      if (req.status === 'PENDING' || req.status === 'L1_APPROVED') {
        const { days: pDays, effectiveType } = calculateRequestedDays(
          new Date(req.startDate),
          new Date(req.endDate),
          holidayDates,
          isSandwichEnabled,
          req.type,
          req.halfDay !== 'NONE'
        )
        const rawType = (effectiveType || req.type).toUpperCase()
        if (rawType === 'PL') {
          pendingPl += pDays
        } else if (rawType === 'CL' || rawType === 'SL') {
          pendingCl += pDays
        } else if (rawType === 'COMP') {
          pendingComp += pDays
        }
      }
    }

    // Server-side check for negative limit including pending leaves
    const activeType = (effectiveType || type).toUpperCase()
    if (type !== 'LOP') {
      const currentPl = balance?.pl || 0
      const currentCl = balance?.cl || 0
      const currentComp = balance?.comp || 0

      let netBalance = 0
      if (activeType === 'PL') {
        netBalance = currentPl - pendingPl - days
      } else if (activeType === 'CL' || activeType === 'SL') {
        netBalance = currentCl - pendingCl - days
      } else if (activeType === 'COMP') {
        netBalance = currentComp - pendingComp - days
      }

      if (activeType === 'COMP' && netBalance < 0) {
        throw new Error("Compensatory Off cannot go into negative balance. Please apply for Loss of Pay instead.")
      }

      if (netBalance < maxNegativeLimit) {
        throw new Error(`Cannot submit request: Net balance would be ${netBalance} days, which exceeds the allowed negative limit of ${maxNegativeLimit} days (including pending requests).`)
      }
    }

    // 1. Probation Rule: PL is blocked during probation
    const systemDate = await getSystemDate()
    if (activeType === 'PL') {
      let probationEnd = user.probationEndDate ? new Date(user.probationEndDate) : null
      if (!probationEnd && user.joinDate) {
        probationEnd = new Date(user.joinDate)
        probationEnd.setMonth(probationEnd.getMonth() + probationMonths)
      }
      if (probationEnd && systemDate < probationEnd) {
        const formattedEnd = probationEnd.toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric'
        })
        throw new Error(`Privilege Leave (PL) is blocked during probation. Your probation period ends on ${formattedEnd}.`)
      }
    }

    // 2. Maternity/Paternity Cap Rules
    if (activeType === 'MAT' && days > matCap) {
      throw new Error(`Maternity Leave (MAT) cannot exceed ${matCap} days.`)
    }
    if (activeType === 'PAT' && days > patCap) {
      throw new Error(`Paternity Leave (PAT) cannot exceed ${patCap} days.`)
    }

    // 3. Friday & Monday Rule for CL
    if (activeType === 'CL') {
      const startDay = startObj.getUTCDay()
      const endDay = endObj.getUTCDay()
      
      const hasFriday = (startDay <= 5 && endDay >= 5) || (startDay === 5)
      const hasMonday = (startDay <= 1 && endDay >= 1) || (endDay === 1)
      const calendarDuration = Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1
      if (hasFriday && hasMonday && calendarDuration >= 3) {
        throw new Error("Friday & Monday Rule: You cannot apply for Casual Leave (CL) on both Friday and Monday.")
      }

      for (const req of existingLeaves) {
        if (req.status !== 'REJECTED' && req.status !== 'CANCELLED' && req.type.toUpperCase() === 'CL') {
          const rStart = new Date(req.startDate).getUTCDay()
          const rEnd = new Date(req.endDate).getUTCDay()
          const rHasFriday = (rStart <= 5 && rEnd >= 5) || (rStart === 5)
          const rHasMonday = (rStart <= 1 && rEnd >= 1) || (rEnd === 1)

          if ((hasFriday && rHasMonday) || (hasMonday && rHasFriday)) {
            throw new Error("Friday & Monday Rule: You cannot apply for Casual Leave (CL) on both Friday and Monday.")
          }
        }
      }
    }

    // 4. National Holiday Adjacency Rule for CL
    if (activeType === 'CL') {
      const oneDay = 24 * 60 * 60 * 1000
      const prevDateStr = new Date(startObj.getTime() - oneDay).toISOString().split('T')[0]
      const nextDateStr = new Date(endObj.getTime() + oneDay).toISOString().split('T')[0]

      if (holidayDates.has(prevDateStr) && holidayDates.has(nextDateStr)) {
        throw new Error("National Holiday Adjacency Rule: Casual Leave (CL) is blocked if holidays sandwich the leave block on both sides.")
      }

      for (const holStr of holidayDates) {
        const holDate = new Date(holStr)
        const dayBeforeHol = new Date(holDate.getTime() - oneDay).toISOString().split('T')[0]
        const dayAfterHol = new Date(holDate.getTime() + oneDay).toISOString().split('T')[0]

        const curHasBefore = startObj.toISOString().split('T')[0] <= dayBeforeHol && endObj.toISOString().split('T')[0] >= dayBeforeHol
        const curHasAfter = startObj.toISOString().split('T')[0] <= dayAfterHol && endObj.toISOString().split('T')[0] >= dayAfterHol

        for (const req of existingLeaves) {
          if (req.status !== 'REJECTED' && req.status !== 'CANCELLED' && req.type.toUpperCase() === 'CL') {
            const reqStart = req.startDate.toISOString().split('T')[0]
            const reqEnd = req.endDate.toISOString().split('T')[0]
            const reqHasBefore = reqStart <= dayBeforeHol && reqEnd >= dayBeforeHol
            const reqHasAfter = reqStart <= dayAfterHol && reqEnd >= dayAfterHol

            if ((curHasBefore && reqHasAfter) || (curHasAfter && reqHasBefore)) {
              throw new Error(`National Holiday Adjacency Rule: Casual Leave (CL) cannot sandwich the national holiday (${holStr}) on both sides.`)
            }
          }
        }
      }
    }

    // Attachment validation
    if (attachmentUrl && attachmentUrl.trim() !== '') {
      if (!validateAttachmentUrl(attachmentUrl)) {
        throw new Error("Invalid attachment URL. Only secure links from Google Drive, Dropbox, SharePoint, or company.com are allowed.")
      }
    }

    // Rule 33: Sick Leave (SL) exceeding 2 days requires document upload
    if (type === 'SL' && days > 2) {
      if (!attachmentUrl || attachmentUrl.trim() === '') {
        throw new Error("Medical certificate attachment is mandatory for Sick Leave exceeding 2 days.")
      }
    }

    // Insert leave request using Prisma
    const request = await prisma.leaveRequest.create({
      data: {
        userId,
        type: activeType,
        startDate: startObj,
        endDate: endObj,
        reason,
        isNegative,
        negativeAmount,
        attachmentUrl: attachmentUrl || null,
        halfDay,
        year: leaveYear,
        status: 'PENDING'
      }
    })

    // Log the action using Prisma
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'LEAVE_APPLIED',
        entity: 'LeaveRequest',
        entityId: request.id,
        metadata: JSON.stringify({ type, startDate, endDate, days, isNegative, attachmentUrl }),
        createdAt: await getSystemDateTime()
      }
    })

    // Fetch HR and Managers for notification
    const adminsAndManagers = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MANAGER'] },
        status: 'ACTIVE'
      },
      select: { email: true, communicationEmail: true }
    })

    const adminEmails = adminsAndManagers.map((u: any) => (u.communicationEmail && u.communicationEmail !== 'noreply@yopmail.com') ? u.communicationEmail : u.email)
    const fallbackUsername = user.email ? user.email.split('@')[0] : (user.name ? user.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') : 'noreply')
    const applicantEmail = (user.communicationEmail && user.communicationEmail !== 'noreply@yopmail.com') ? user.communicationEmail : (user.email || `${fallbackUsername}@yopmail.com`)

    const formattedStartDate = startObj.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
    const formattedEndDate = endObj.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })

    // 1. Notify Applicant
    await sendEmail({
      to: applicantEmail,
      subject: `Leave Application Received: ${type} (${days} days)`,
      html: `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #2563eb; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear ${user.name || 'Employee'},</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        We have successfully received your leave application. It is currently <span style="background-color: #dbeafe; color: #1e3a8a; padding: 4px 8px; border-radius: 4px; font-weight: 600;">Pending Approval</span>.
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">LEAVE DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Leave Type</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${type}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Duration</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${formattedStartDate} <span style="color: #94a3b8; font-weight: normal; margin: 0 4px;">to</span> ${formattedEndDate}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Total Days</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${days}</td>
        </tr>
        <tr>
          <td style="padding: 16px; color: #64748b; font-size: 14px;">Reason</td>
          <td style="padding: 16px; color: #0f172a; font-size: 14px; font-weight: 600;">${reason}</td>
        </tr>
      </table>
      <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 32px;">
        We will notify you once a decision has been made by your manager or the HR department.
      </p>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Best Regards,</div>
        <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">Human Resources Team</div>
        <div style="color: #64748b;">Unique School India LLP</div>
      </div>
    </div>
  </div>
  <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px;">
    This is an automated notification from the Leave Management System (LMS).
  </div>
</div>
      `
    })

    // 2. Notify HR & Managers
    if (adminEmails.length > 0) {
      const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      await Promise.all(adminEmails.map((email: string) => 
        sendEmail({
          to: email,
          subject: `[Action Required] New Leave Request: ${user.name} (${type})`,
          html: `
<div style="background-color: #f8fafc; padding: 40px 20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
    <div style="background-color: #4f46e5; color: #ffffff; padding: 24px; text-align: center;">
      <span style="font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: 0.9; display: block; margin-bottom: 4px;">LMS Admin Portal</span>
      <h1 style="font-size: 20px; font-weight: 600; margin: 0; letter-spacing: 0.5px;">Pending Leave Approval</h1>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 600; margin-bottom: 8px;">Hello Administrator,</h2>
      <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
        A new leave application has been submitted and is waiting for your decision. Please review the details below:
      </p>
      
      <div style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
        <span style="font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">Action Required</span>
        <span style="font-size: 15px; color: #1e293b; font-weight: 600; display: block;">${user.name} &mdash; ${type} Request</span>
      </div>

      <div style="font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">REQUEST DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 28px; border-collapse: separate; overflow: hidden; font-size: 14px;">
        <tr>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 35%;">Employee</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${user.name}</td>
        </tr>
        <tr>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Leave Type</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${type}</td>
        </tr>
        <tr>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Duration</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${formattedStartDate} <span style="color: #94a3b8; font-weight: normal; margin: 0 4px;">to</span> ${formattedEndDate}</td>
        </tr>
        <tr>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Total Days</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${days}</td>
        </tr>
        <tr>
          <td style="padding: 14px 16px; color: #64748b;">Reason</td>
          <td style="padding: 14px 16px; color: #0f172a; font-weight: 600;">${reason}</td>
        </tr>
      </table>

      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${appUrl}/requests" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1);">
          Review & Respond
        </a>
      </div>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px; text-align: center;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Leave Management System</div>
        <div style="color: #cbd5e1; font-size: 12px;">Unique School India LLP</div>
      </div>
    </div>
  </div>
  <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px;">
    This is an automated administrative notification. Please do not reply directly to this message.
  </div>
</div>
        `
        })
      ))
    }

    revalidatePath("/portal")
    revalidatePath("/")
    return { success: true, request }
  } catch (err: any) {
    console.error("submitLeaveRequest Error:", err)
    return { success: false, error: err.message || "Failed to submit leave request." }
  }
}

export async function submitCompOffWork(data: {
  userId: string
  dateWorked: string
  hoursWorked: number
  reason: string
}) {
  try {
    const { userId, dateWorked, hoursWorked, reason } = data
  
    // Verify session matches userId
    const session = await getServerSession()
    if (!session || session.user.id !== userId) {
      throw new Error("Unauthorized: Session mismatch or not logged in.")
    }

    let daysCredited = hoursWorked >= 8 ? 1.0 : (hoursWorked >= 4 ? 0.5 : 0)

    // Insert comp off entry using Prisma
    const entry = await prisma.compOffWorkEntry.create({
      data: {
        userId: userId,
        dateWorked: new Date(dateWorked),
        hoursWorked: hoursWorked,
        reason: reason,
        daysCredited: daysCredited,
        status: "PENDING"
      }
    })

    // Log the action using Prisma
    await prisma.auditLog.create({
      data: {
        userId: userId,
        action: 'COMPOFF_WORK_LOGGED',
        entity: 'CompOffWorkEntry',
        entityId: entry.id,
        metadata: JSON.stringify({ dateWorked, hoursWorked, daysCredited }),
        createdAt: await getSystemDateTime()
      }
    })

    // Fetch HR and Managers for notification
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, communicationEmail: true }
    })

    const adminsAndManagers = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MANAGER'] },
        status: 'ACTIVE'
      },
      select: { email: true, communicationEmail: true }
    })

    const adminEmails = adminsAndManagers.map((u: any) => (u.communicationEmail && u.communicationEmail !== 'noreply@yopmail.com') ? u.communicationEmail : u.email)
    const fallbackUsername = user?.email ? user.email.split('@')[0] : (user?.name ? user.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') : 'noreply')
    const applicantEmail = (user?.communicationEmail && user.communicationEmail !== 'noreply@yopmail.com') ? user.communicationEmail : (user?.email || `${fallbackUsername}@yopmail.com`)

    const formattedDate = new Date(dateWorked).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })

    // 1. Notify Applicant
    await sendEmail({
      to: applicantEmail,
      subject: `Comp-Off Logged: ${formattedDate} (${hoursWorked} hours)`,
      html: `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #2563eb; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear ${user?.name || 'Employee'},</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        We have successfully received your Comp-Off logging request. It is currently <span style="background-color: #dbeafe; color: #1e3a8a; padding: 4px 8px; border-radius: 4px; font-weight: 600;">Pending Approval</span>.
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">COMP-OFF DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Date Worked</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Hours Logged</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${hoursWorked} hrs</td>
        </tr>
        <tr>
          <td style="padding: 16px; color: #64748b; font-size: 14px;">Reason/Task</td>
          <td style="padding: 16px; color: #0f172a; font-size: 14px; font-weight: 600;">${reason}</td>
        </tr>
      </table>
      <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 32px;">
        Once approved, the corresponding leave balance will be credited to your account.
      </p>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Best Regards,</div>
        <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">Human Resources Team</div>
        <div style="color: #64748b;">Unique School India LLP</div>
      </div>
    </div>
  </div>
  <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px;">
    This is an automated notification from the Leave Management System (LMS).
  </div>
</div>
      `
    })

    // 2. Notify HR & Managers
    if (adminEmails.length > 0) {
      const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      await Promise.all(adminEmails.map((email: string) => 
        sendEmail({
          to: email,
          subject: `[Action Required] New Comp-Off Request: ${user?.name}`,
          html: `
<div style="background-color: #f8fafc; padding: 40px 20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
    <div style="background-color: #4f46e5; color: #ffffff; padding: 24px; text-align: center;">
      <span style="font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: 0.9; display: block; margin-bottom: 4px;">LMS Admin Portal</span>
      <h1 style="font-size: 20px; font-weight: 600; margin: 0; letter-spacing: 0.5px;">Pending Comp-Off Approval</h1>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 600; margin-bottom: 8px;">Hello Administrator,</h2>
      <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
        A new comp-off hours claim has been logged and is waiting for your decision. Please review the details below:
      </p>
      
      <div style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
        <span style="font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">Action Required</span>
        <span style="font-size: 15px; color: #1e293b; font-weight: 600; display: block;">${user?.name} &mdash; Comp-Off Logging Request</span>
      </div>

      <div style="font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">COMP-OFF DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 28px; border-collapse: separate; overflow: hidden; font-size: 14px;">
        <tr>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 35%;">Employee</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${user?.name}</td>
        </tr>
        <tr>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Date Worked</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Hours Logged</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${hoursWorked} hrs</td>
        </tr>
        <tr>
          <td style="padding: 14px 16px; color: #64748b;">Reason/Task</td>
          <td style="padding: 14px 16px; color: #0f172a; font-weight: 600;">${reason}</td>
        </tr>
      </table>

      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${appUrl}/requests" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1);">
          Review & Respond
        </a>
      </div>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px; text-align: center;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Leave Management System</div>
        <div style="color: #cbd5e1; font-size: 12px;">Unique School India LLP</div>
      </div>
    </div>
  </div>
  <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px;">
    This is an automated administrative notification. Please do not reply directly to this message.
  </div>
</div>
        `
      })))
    }

    revalidatePath("/portal")
    return { success: true, entry }
  } catch (err: any) {
    console.error("submitCompOffWork Error:", err)
    return { success: false, error: err.message || "Failed to submit request." }
  }
}
