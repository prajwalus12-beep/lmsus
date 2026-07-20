import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSystemDate } from "@/lib/systemDate"

export async function GET(request: Request) {
  try {
    const today = await getSystemDate()

    // Find all APPROVED comp-off entries that have expired and haven't been marked as EXPIRED yet
    const expiredEntries = await prisma.compOffWorkEntry.findMany({
      where: {
        status: 'APPROVED',
        expiryDate: { lt: today }
      }
    })

    if (!expiredEntries || expiredEntries.length === 0) {
      return NextResponse.json({ success: true, message: "No expired comp-offs found" })
    }

    let expiredCount = 0

    // For each expired entry, deduct from COMP balance and mark entry as EXPIRED.
    for (const entry of expiredEntries) {
      const balance = await prisma.leaveBalance.findFirst({
        where: {
          userId: entry.userId,
          year: new Date(entry.dateWorked).getFullYear()
        }
      })

      if (balance && balance.comp > 0) {
        const deductAmount = Math.min(entry.daysCredited, balance.comp)

        // Mark comp-off work entry as EXPIRED
        await prisma.compOffWorkEntry.update({
          where: { id: entry.id },
          data: { status: 'EXPIRED', updatedAt: new Date() }
        })

        // Deduct from balance
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: { 
            comp: balance.comp - deductAmount,
            updatedAt: new Date()
          }
        })

        // Log in audit log
        await prisma.auditLog.create({
          data: {
            userId: entry.userId,
            action: "COMP_OFF_EXPIRED",
            entity: "CompOffWorkEntry",
            entityId: entry.id,
            oldValue: String(balance.comp),
            newValue: String(balance.comp - deductAmount),
            metadata: JSON.stringify({ reason: "Cron auto-expiry", daysCredited: entry.daysCredited }),
            createdAt: new Date()
          }
        })

        expiredCount++
      } else {
        // If they have 0 balance, just mark it as EXPIRED
        await prisma.compOffWorkEntry.update({
          where: { id: entry.id },
          data: { status: 'EXPIRED', updatedAt: new Date() }
        })
      }
    }

    return NextResponse.json({ success: true, count: expiredCount })
  } catch (err: any) {
    console.error("Cron Error:", err)
    return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 })
  }
}
