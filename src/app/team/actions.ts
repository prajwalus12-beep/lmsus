"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export type CsvEmployeeRow = {
  name: string
  email: string
  role: string
  departmentName: string
  joinDate: string
}

export async function importEmployees(rows: CsvEmployeeRow[]) {
  const defaultPassword = await bcrypt.hash("Unique@123", 12)
  let importedCount = 0

  for (const row of rows) {
    if (!row.name || !row.email) continue

    // Find or create department
    let departmentId = null
    if (row.departmentName) {
      let dept = await prisma.department.findUnique({
        where: { name: row.departmentName },
      })
      if (!dept) {
        dept = await prisma.department.create({
          data: { name: row.departmentName },
        })
      }
      departmentId = dept.id
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email: row.email } })
    if (existingUser) continue

    // Create User
    const user = await prisma.user.create({
      data: {
        name: row.name,
        email: row.email,
        role: row.role || "EMPLOYEE",
        password: defaultPassword,
        departmentId,
        joinDate: row.joinDate ? new Date(row.joinDate) : new Date(),
      },
    })

    // Create default LeaveBalance
    await prisma.leaveBalance.create({
      data: {
        userId: user.id,
        year: new Date().getFullYear(),
        pl: 0,
        cl: 0,
        sl: 0,
        comp: 0,
        openingPl: 0,
        openingCl: 0,
        openingComp: 0,
      },
    })
    
    importedCount++
  }

  revalidatePath("/team")
  return { success: true, count: importedCount }
}

export async function updateEmployee(
  id: string,
  data: {
    name: string
    role: string
    status?: string
    lastWorkingDay?: string | null
    probationEndDate?: string | null
  }
) {
  await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      role: data.role,
      status: data.status,
      lastWorkingDay: data.lastWorkingDay ? new Date(data.lastWorkingDay) : null,
      probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
    },
  })
  revalidatePath("/team")
  return { success: true }
}

export async function saveProratedBalances(
  userId: string,
  balances: { pl: number; cl: number; sl: number }
) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("Unauthorized")
  const adminUser = session.user as any

  const existingBalance = await prisma.leaveBalance.findUnique({ where: { userId } })
  if (!existingBalance) throw new Error("No leave balance found for this user")

  await prisma.leaveBalance.update({
    where: { userId },
    data: {
      pl: balances.pl,
      cl: balances.cl,
      sl: balances.sl,
      openingPl: balances.pl,
      openingCl: balances.cl,
    },
  })

  // Log the adjustment in AuditLog
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: "PRORATE_LEAVE_ADJUSTMENT",
      entity: "LeaveBalance",
      entityId: userId,
      newValue: JSON.stringify(balances),
      metadata: JSON.stringify({
        adminName: adminUser.name,
        pl: balances.pl,
        cl: balances.cl,
        sl: balances.sl,
      }),
    },
  })

  revalidatePath("/team")
  return { success: true }
}
