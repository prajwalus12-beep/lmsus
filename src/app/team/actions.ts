"use server"

import { PrismaClient } from "@prisma/client"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

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
        year: 2026,
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

export async function updateEmployee(id: string, data: { name: string, role: string, lastWorkingDay?: string | null }) {
  await prisma.user.update({
    where: { id },
    data: { 
      name: data.name, 
      role: data.role,
      lastWorkingDay: data.lastWorkingDay ? new Date(data.lastWorkingDay) : null
    }
  })
  revalidatePath("/team")
  return { success: true }
}
