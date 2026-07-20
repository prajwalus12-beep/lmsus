"use server"

import prisma from "@/lib/prisma"
import { getServerSession } from "@/lib/supabaseServer"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { getSystemDateTime } from "@/lib/systemDate"
import bcrypt from "bcryptjs"

export type CsvEmployeeRow = {
  name: string
  email: string
  role: string
  departmentName: string
  joinDate: string
}

export async function importEmployees(rows: CsvEmployeeRow[]) {
  const session = await getServerSession()
  if (!session || (session.user as any).role !== 'ADMIN') throw new Error("Unauthorized")

  let importedCount = 0

  // Fetch probation period config once
  const probationConfig = await prisma.systemConfig.findUnique({
    where: { key: 'PROBATION_PERIOD_MONTHS' }
  })
  
  const probationMonths = parseInt(probationConfig?.value || "6")

  for (const row of rows) {
    if (!row.name || !row.email) continue

    // 1. Find or create department
    let departmentId = null
    if (row.departmentName) {
      let dept = await prisma.department.findUnique({
        where: { name: row.departmentName }
      })

      if (dept) {
        departmentId = dept.id
      } else {
        dept = await prisma.department.create({
          data: { name: row.departmentName }
        })
        departmentId = dept.id
      }
    }

    // 2. Create User in Prisma database with hashed password
    const hashedPassword = bcrypt.hashSync("Unique@123", 12)
    const joinDateObj = row.joinDate ? new Date(row.joinDate) : (await getSystemDateTime())
    const probationEndDate = new Date(joinDateObj)
    probationEndDate.setMonth(probationEndDate.getMonth() + probationMonths)

    const user = await prisma.user.create({
      data: {
        name: row.name,
        email: row.email.toLowerCase().trim(),
        password: hashedPassword,
        role: row.role || "EMPLOYEE",
        departmentId: departmentId,
        joinDate: joinDateObj,
        probationEndDate: probationEndDate,
        status: 'ACTIVE',
        communicationEmail: row.email.toLowerCase().trim()
      }
    })

    const userId = user.id

    // 3. Create default leave_balances
    await prisma.leaveBalance.create({
      data: {
        userId: userId,
        year: new Date().getFullYear(),
        openingPl: 0,
        openingCl: 0,
        openingComp: 0,
        pl: 0,
        cl: 0,
        sl: 0,
        comp: 0
      }
    })

    // 4. Send Welcome Email
    try {
      const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      await sendEmail({
        to: row.email,
        subject: `Welcome to the Leave Management System (LMS) - Account Created`,
        html: `
<div style="background-color: #f8fafc; padding: 40px 20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
    <div style="background-color: #4f46e5; color: #ffffff; padding: 28px; text-align: center;">
      <span style="font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: 0.9; display: block; margin-bottom: 4px;">Leave Management System</span>
      <h1 style="font-size: 22px; font-weight: 600; margin: 0; letter-spacing: 0.5px;">Welcome to LMS!</h1>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 600; margin-bottom: 8px;">Hello ${row.name},</h2>
      <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
        An account has been created for you on the Leave Management System. You can now log in and start managing your leave balance, submissions, and calendar.
      </p>
      
      <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 24px; font-size: 14px;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 12px;">Your Login Credentials</span>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color: #64748b; padding-bottom: 8px; width: 35%;">Portal URL</td>
            <td style="color: #0f172a; font-weight: 600; padding-bottom: 8px;"><a href="${appUrl}/login" style="color: #4f46e5; text-decoration: none;">${appUrl}/login</a></td>
          </tr>
          <tr>
            <td style="color: #64748b; padding-bottom: 8px;">Email Address</td>
            <td style="color: #0f172a; font-weight: 600; padding-bottom: 8px;">${row.email}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Password</td>
            <td style="color: #0f172a; font-weight: 600; font-family: monospace; font-size: 15px;">Unique@123</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${appUrl}/login" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
          Log In to Portal
        </a>
      </div>

      <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 28px; font-size: 13.5px; color: #b45309; line-height: 1.5;">
        <strong>Security Notice:</strong> For security reasons, we strongly recommend that you change your password immediately after logging in for the first time.
      </div>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px; text-align: center;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Leave Management System</div>
        <div style="color: #cbd5e1; font-size: 12px;">Unique School India LLP</div>
      </div>
    </div>
  </div>
</div>
      `
      })
    } catch (emailErr) {
      console.error("Failed to send CSV welcome email:", emailErr)
    }

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
    departmentId?: string
    status?: string
    lastWorkingDay?: string | null
    probationEndDate?: string | null
  }
) {
  const session = await getServerSession()
  if (!session || session.user.role !== 'ADMIN') throw new Error("Unauthorized")

  await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      role: data.role,
      departmentId: data.departmentId || null,
      status: data.status,
      lastWorkingDay: data.lastWorkingDay ? new Date(data.lastWorkingDay) : null,
      probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
      updatedAt: await getSystemDateTime()
    }
  })

  revalidatePath("/team")
  return { success: true }
}

export async function saveProratedBalances(
  userId: string,
  balances: { pl: number; cl: number; sl: number }
) {
  const session = await getServerSession()
  if (!session || session.user.role !== 'ADMIN') throw new Error("Unauthorized")
  const adminUser = session.user as any

  const latestBalance = await prisma.leaveBalance.findFirst({
    where: { userId },
    orderBy: { year: 'desc' }
  })

  if (!latestBalance) throw new Error("Leave balance record not found")

  await prisma.leaveBalance.update({
    where: { id: latestBalance.id },
    data: {
      pl: balances.pl,
      cl: balances.cl,
      sl: balances.sl,
      openingPl: balances.pl,
      openingCl: balances.cl,
      updatedAt: await getSystemDateTime()
    }
  })

  // Log the adjustment in AuditLog
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: "PRORATE_LEAVE_ADJUSTMENT",
      entity: "LeaveBalance",
      entityId: userId,
      metadata: JSON.stringify({
        adminName: adminUser.name,
        pl: balances.pl,
        cl: balances.cl,
        sl: balances.sl,
      }),
      createdAt: await getSystemDateTime()
    }
  })

  revalidatePath("/team")
  return { success: true }
}

export async function deleteEmployee(userId: string) {
  const session = await getServerSession()
  if (!session || (session.user as any).role !== 'ADMIN') {
    return { success: false, error: "Unauthorized: Only administrators can delete employees." }
  }

  // 1. Nullify approvedById references in leave requests and comp off entries
  await prisma.leaveRequest.updateMany({
    where: { approvedById: userId },
    data: { approvedById: null }
  })

  await prisma.compOffWorkEntry.updateMany({
    where: { approvedById: userId },
    data: { approvedById: null }
  })

  // 2. Delete Audit Logs associated with the user
  await prisma.auditLog.deleteMany({
    where: { userId }
  })

  // 3. Delete the user from database (cascades automatically to leave_balances etc. if defined)
  await prisma.user.delete({
    where: { id: userId }
  })

  revalidatePath("/team")
  return { success: true }
}
