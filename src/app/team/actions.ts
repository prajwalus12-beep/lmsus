"use server"

import { getSupabaseServer, getServerSession } from "@/lib/supabaseServer"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { revalidatePath } from "next/cache"

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
  const { data: probationConfig } = await supabaseAdmin
    .from('system_configs')
    .select('value')
    .eq('key', 'PROBATION_PERIOD_MONTHS')
    .single()
  
  const probationMonths = parseInt(probationConfig?.value || "6")

  for (const row of rows) {
    if (!row.name || !row.email) continue

    // 1. Find or create department
    let departmentId = null
    if (row.departmentName) {
      const { data: depts } = await supabaseAdmin
        .from('departments')
        .select('id')
        .eq('name', row.departmentName)
        .maybeSingle()

      if (depts) {
        departmentId = depts.id
      } else {
        const { data: newDept } = await supabaseAdmin
          .from('departments')
          .insert({ name: row.departmentName })
          .select('id')
          .single()
        if (newDept) departmentId = newDept.id
      }
    }

    // 2. Create User in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: row.email,
      password: "Unique@123",
      email_confirm: true,
      user_metadata: { name: row.name, role: row.role || "EMPLOYEE" }
    })

    if (authError) {
      console.error(`Error importing ${row.email}:`, authError.message)
      continue
    }

    const userId = authData.user.id

    // 3. Update the profile record (created by trigger)
    const joinDateObj = row.joinDate ? new Date(row.joinDate) : new Date()
    const probationEndDate = new Date(joinDateObj)
    probationEndDate.setMonth(probationEndDate.getMonth() + probationMonths)

    await supabaseAdmin
      .from('profiles')
      .update({
        department_id: departmentId,
        join_date: joinDateObj.toISOString(),
        probation_end_date: probationEndDate.toISOString(),
        status: 'ACTIVE'
      })
      .eq('id', userId)

    // 4. Create default leave_balances
    await supabaseAdmin
      .from('leave_balances')
      .insert({
        user_id: userId,
        year: new Date().getFullYear(),
        opening_pl: 0,
        opening_cl: 0,
        pl: 0,
        cl: 0,
        sl: 0,
        comp: 0
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
  const session = await getServerSession()
  if (!session || session.user.role !== 'ADMIN') throw new Error("Unauthorized")

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      name: data.name,
      role: data.role,
      status: data.status,
      last_working_day: data.lastWorkingDay ? new Date(data.lastWorkingDay).toISOString() : null,
      probation_end_date: data.probationEndDate ? new Date(data.probationEndDate).toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

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

  const { error: updateError } = await supabaseAdmin
    .from('leave_balances')
    .update({
      pl: balances.pl,
      cl: balances.cl,
      sl: balances.sl,
      opening_pl: balances.pl,
      opening_cl: balances.cl,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)

  if (updateError) throw new Error(updateError.message)

  // Log the adjustment in AuditLog
  const { error: auditError } = await supabaseAdmin
    .from('audit_logs')
    .insert({
      user_id: adminUser.id,
      action: "PRORATE_LEAVE_ADJUSTMENT",
      entity: "LeaveBalance",
      entity_id: userId,
      metadata: JSON.stringify({
        adminName: adminUser.name,
        pl: balances.pl,
        cl: balances.cl,
        sl: balances.sl,
      })
    })

  if (auditError) console.error("Error creating audit log:", auditError)

  revalidatePath("/team")
  return { success: true }
}
