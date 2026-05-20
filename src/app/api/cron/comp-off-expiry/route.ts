import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { getSystemDate } from "@/lib/systemDate"

const prisma = new PrismaClient()

// This route should be secured in production using an Authorization header 
// matching a secret token configured in Vercel Cron or similar.
export async function GET(request: Request) {
  try {
    const today = await getSystemDate()
    
    // Find all APPROVED comp-off entries that have expired and haven't been marked as EXPIRED yet
    // Rule 41: Expiry windows (30, 45, 60 days). We assume 30 days is standard for now, 
    // or we check the expiryDate field which was calculated upon approval.
    
    const expiredEntries = await prisma.compOffWorkEntry.findMany({
      where: {
        status: "APPROVED",
        expiryDate: {
          lt: today
        }
      }
    })

    if (expiredEntries.length === 0) {
      return NextResponse.json({ success: true, message: "No expired comp-offs found" })
    }

    let expiredCount = 0

    // For each expired entry, we need to deduct the days from the user's COMP balance 
    // and mark the entry as EXPIRED.
    for (const entry of expiredEntries) {
      // Find the user's current leave balance
      const balance = await prisma.leaveBalance.findUnique({
        where: { userId: entry.userId }
      })

      if (balance && balance.comp > 0) {
        // Only deduct up to what was credited, and don't go below 0 for comp.
        // If the user already used it, their balance might be lower than the credited amount.
        const deductAmount = Math.min(entry.daysCredited, balance.comp)
        
        await prisma.$transaction([
          prisma.compOffWorkEntry.update({
            where: { id: entry.id },
            data: { status: "EXPIRED" }
          }),
          prisma.leaveBalance.update({
            where: { id: balance.id },
            data: { comp: { decrement: deductAmount } }
          }),
          prisma.auditLog.create({
            data: {
              userId: entry.userId,
              action: "COMP_OFF_EXPIRED",
              entity: "CompOffWorkEntry",
              entityId: entry.id,
              oldValue: String(balance.comp),
              newValue: String(balance.comp - deductAmount),
              metadata: JSON.stringify({ reason: "Cron auto-expiry", daysCredited: entry.daysCredited })
            }
          })
        ])
        expiredCount++
      } else {
        // If they have 0 balance, just mark it as USED/EXPIRED
        await prisma.compOffWorkEntry.update({
          where: { id: entry.id },
          data: { status: "EXPIRED" }
        })
      }
    }

    return NextResponse.json({ success: true, count: expiredCount })
  } catch (err) {
    console.error("Cron Error:", err)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}
