"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { sendEmail } from "@/lib/email"
import { calculateRequestedDays } from "@/lib/leaveCalculator"
import { syncUserLedger } from "@/lib/ledgerSync"

export async function approveRequest(id: string) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("Unauthorized")

  const userRole = (session.user as any).role
  const approverId = (session.user as any).id
  const status = userRole === "ADMIN" ? "HR_APPROVED" : "L1_APPROVED"

  const request = await prisma.leaveRequest.update({
    where: { id },
    data: { 
      status,
      approvedById: approverId,
      approvedAt: new Date()
    },
    include: { user: true }
  })

  // If HR approved, we need to deduct from balance
  if (status === "HR_APPROVED") {
    // 1. Fetch holidays and config for the calculator
    const [holidays, sandwichConfig] = await Promise.all([
      prisma.holiday.findMany({
        where: { date: { gte: new Date(request.startDate.getFullYear(), 0, 1), lte: new Date(request.startDate.getFullYear(), 11, 31) } }
      }),
      prisma.systemConfig.findUnique({ where: { key: "weekend_sandwich_rule" } })
    ]);

    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))
    const isSandwichEnabled = sandwichConfig?.value === "true"

    // 2. Calculate days (Now Fast & Sync)
    const { days } = calculateRequestedDays(
      request.startDate, 
      request.endDate, 
      holidayDates, 
      isSandwichEnabled, 
      request.type, 
      request.halfDay !== "NONE"
    )
    
    const leaveType = request.type.toLowerCase() // pl, cl, sl
    
    const balance = await prisma.leaveBalance.findUnique({
      where: { userId: request.userId }
    })

    if (balance) {
      await prisma.leaveBalance.update({
        where: { userId: request.userId },
        data: {
          [leaveType]: { decrement: days },
          [`${leaveType}Used`]: { increment: days }
        }
      })
      
      // Keep ledger in sync
      await syncUserLedger(request.userId, request.startDate.getFullYear())
    }
  }

  // Email logic...
  const targetEmail = request.user.communicationEmail || request.user.email
  if (targetEmail) {
    await sendEmail({
      to: targetEmail,
      subject: `Leave Request Approved`,
      html: `<p>Your leave from ${request.startDate.toLocaleDateString()} has been Approved.</p>`
    })
  }

  revalidatePath("/requests")
  revalidatePath("/ledger")
  return { success: true }
}

export async function rejectRequest(id: string) {
  const request = await prisma.leaveRequest.update({
    where: { id },
    data: { status: "REJECTED" },
    include: { user: true }
  })

  revalidatePath("/requests")
  return { success: true }
}

export async function approveCompOff(id: string) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("Unauthorized")
  const approverId = (session.user as any).id

  return await prisma.$transaction(async (tx) => {
    const entry = await tx.compOffWorkEntry.update({
      where: { id },
      data: { 
        status: "APPROVED",
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        approvedById: approverId,
        approvedAt: new Date()
      },
      include: { user: true }
    })

    await tx.leaveBalance.update({
      where: { userId: entry.userId },
      data: {
        comp: { increment: entry.daysCredited }
      }
    })

    revalidatePath("/requests")
    revalidatePath("/portal")
    return { success: true }
  })
}

export async function rejectCompOff(id: string) {
  await prisma.compOffWorkEntry.update({
    where: { id },
    data: { status: "REJECTED" }
  })
  revalidatePath("/requests")
  return { success: true }
}
