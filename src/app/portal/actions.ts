"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { calculateRequestedDays } from "@/lib/leaveCalculator"
import { sendEmail } from "@/lib/email"

export async function submitLeaveRequest(data: {
  userId: string
  type: string
  startDate: string
  endDate: string
  reason: string
  isNegative: boolean
  negativeAmount: number
  attachmentUrl?: string
}) {
  const { userId, type, startDate, endDate, reason, isNegative, negativeAmount, attachmentUrl } = data

  const [user, holidays, sandwichConfig, probationConfig] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, communicationEmail: true, joinDate: true }
    }),
    prisma.holiday.findMany({
      where: { date: { gte: new Date(new Date(startDate).getFullYear(), 0, 1), lte: new Date(new Date(startDate).getFullYear(), 11, 31) } }
    }),
    prisma.systemConfig.findUnique({ where: { key: "weekend_sandwich_rule" } }),
    prisma.systemConfig.findUnique({ where: { key: "PROBATION_PERIOD_MONTHS" } })
  ]);
  
  const probationMonths = parseInt(probationConfig?.value || "6")

  // Rule 50: Probation Check
  if (type === 'PL') {
    const probationLimit = new Date()
    probationLimit.setMonth(probationLimit.getMonth() - probationMonths)
    if (user && user.joinDate > probationLimit) {
      throw new Error(`Privilege Leave (PL) cannot be applied during the ${probationMonths}-month probation period (Rule 50).`)
    }
  }

  const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))
  const isSandwichEnabled = sandwichConfig?.value === "true"

  const { days } = calculateRequestedDays(
    new Date(startDate), 
    new Date(endDate), 
    holidayDates, 
    isSandwichEnabled, 
    type, 
    false
  )

  const request = await prisma.leaveRequest.create({
    data: {
      userId,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
      status: "PENDING",
      isNegative,
      negativeAmount,
      attachmentUrl,
      year: new Date().getFullYear(),
    },
  })

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'LEAVE_APPLIED',
      entity: 'LeaveRequest',
      entityId: request.id,
      metadata: JSON.stringify({ type, startDate, endDate, days, isNegative, attachmentUrl })
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

  const adminEmails = adminsAndManagers.map(u => u.communicationEmail || u.email)
  const applicantEmail = user?.communicationEmail || user?.email || "sandeepjain200019@gmail.com"

  // 1. Notify Applicant
  await sendEmail({
    to: applicantEmail,
    subject: `Leave Application Received: ${type} (${days} days)`,
    html: `<p>Hello ${user?.name}, your request for ${days} days is Pending Approval.</p>`
  })

  // 2. Notify HR & Managers
  if (adminEmails.length > 0) {
    await Promise.all(adminEmails.map(email => 
      sendEmail({
        to: email,
        subject: `New Leave Application: ${user?.name} (${type})`,
        html: `<p>${user?.name} has applied for ${days} days of ${type} leave from ${startDate} to ${endDate}.</p><p>Reason: ${reason}</p>`
      })
    ))
  }

  revalidatePath("/portal")
  revalidatePath("/")
  return { success: true, request }
}

export async function submitCompOffWork(data: {
  userId: string
  dateWorked: string
  hoursWorked: number
  reason: string
}) {
  const { userId, dateWorked, hoursWorked, reason } = data
  let daysCredited = hoursWorked >= 8 ? 1.0 : (hoursWorked >= 4 ? 0.5 : 0)

  const entry = await prisma.compOffWorkEntry.create({
    data: {
      userId,
      dateWorked: new Date(dateWorked),
      hoursWorked,
      reason,
      daysCredited,
      status: "PENDING"
    }
  })

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'COMPOFF_WORK_LOGGED',
      entity: 'CompOffWorkEntry',
      entityId: entry.id,
      metadata: JSON.stringify({ dateWorked, hoursWorked, daysCredited })
    }
  })

  revalidatePath("/portal")
  return { success: true, entry }
}
