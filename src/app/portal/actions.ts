"use server"

import { getSupabaseServer, getServerSession } from "@/lib/supabaseServer"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
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
  halfDay?: string
}) {
  let { userId, type, startDate, endDate, reason, isNegative, negativeAmount, attachmentUrl, halfDay = "NONE" } = data
  
  // Verify session matches userId
  const session = await getServerSession()
  if (!session || session.user.id !== userId) {
    throw new Error("Unauthorized: Session mismatch or not logged in.")
  }

  const supabase = await getSupabaseServer()
  const startObj = new Date(startDate)
  const leaveYear = startObj.getFullYear()

  const yearStart = `${leaveYear}-01-01`
  const yearEnd = `${leaveYear}-12-31`

  const [
    { data: user },
    { data: holidays },
    { data: sandwichConfig },
    { data: probationConfig }
  ] = await Promise.all([
    supabase.from('profiles').select('name, email, communication_email, join_date').eq('id', userId).single(),
    supabase.from('holidays').select('*').gte('date', yearStart).lte('date', yearEnd),
    supabase.from('system_configs').select('value').eq('key', 'weekend_sandwich_rule').single(),
    supabase.from('system_configs').select('value').eq('key', 'PROBATION_PERIOD_MONTHS').single()
  ]);
  
  const probationMonths = parseInt(probationConfig?.value || "6")

  const holidayDates = new Set((holidays || []).map((h: any) => h.date.split('T')[0]))
  const isSandwichEnabled = sandwichConfig?.value === "true"

  const isHalfDay = halfDay !== "NONE"
  const { days, convertedToPl } = calculateRequestedDays(
    startObj, 
    new Date(endDate), 
    holidayDates, 
    isSandwichEnabled, 
    type, 
    isHalfDay
  )

  // Rule 37: Auto-convert CL to PL
  if (convertedToPl) {
    type = "PL"
  }

  // Rule 50: Probation Check (Apply AFTER potential conversion)
  if (type === 'PL') {
    const probationLimit = new Date()
    probationLimit.setMonth(probationLimit.getMonth() - probationMonths)
    if (user && new Date(user.join_date) > probationLimit) {
      throw new Error(`Privilege Leave (PL) cannot be applied during the ${probationMonths}-month probation period (Rule 50).`)
    }
  }

  // Use supabaseAdmin to bypass RLS for insertion
  const { data: request, error: insertError } = await supabaseAdmin
    .from('leave_requests')
    .insert({
      user_id: userId,
      type,
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      half_day: halfDay,
      reason,
      status: "PENDING",
      is_negative: isNegative,
      negative_amount: negativeAmount,
      attachment_url: attachmentUrl || null,
      year: leaveYear,
    })
    .select()
    .single()

  if (insertError) {
    console.error('Insert Error:', insertError)
    throw new Error(insertError.message)
  }

  // Log the action using admin client
  await supabaseAdmin.from('audit_logs').insert({
    user_id: userId,
    action: 'LEAVE_APPLIED',
    entity: 'LeaveRequest',
    entity_id: request.id,
    metadata: JSON.stringify({ type, startDate, endDate, days, isNegative, attachmentUrl })
  })

  // Fetch HR and Managers for notification
  const { data: adminsAndManagers } = await supabase
    .from('profiles')
    .select('email, communication_email')
    .in('role', ['ADMIN', 'MANAGER'])
    .eq('status', 'ACTIVE')

  const adminEmails = (adminsAndManagers || []).map((u: any) => u.communication_email || u.email)
  const applicantEmail = user?.communication_email || user?.email || "sandeepjain200019@gmail.com"

  // 1. Notify Applicant
  await sendEmail({
    to: applicantEmail,
    subject: `Leave Application Received: ${type} (${days} days)`,
    html: `<p>Hello ${user?.name}, your request for ${days} days is Pending Approval.</p>`
  })

  // 2. Notify HR & Managers
  if (adminEmails.length > 0) {
    await Promise.all(adminEmails.map((email: string) => 
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
  
  // Verify session matches userId
  const session = await getServerSession()
  if (!session || session.user.id !== userId) {
    throw new Error("Unauthorized: Session mismatch or not logged in.")
  }

  let daysCredited = hoursWorked >= 8 ? 1.0 : (hoursWorked >= 4 ? 0.5 : 0)

  // Use supabaseAdmin to bypass RLS for insertion
  const { data: entry, error } = await supabaseAdmin
    .from('comp_off_work_entries')
    .insert({
      user_id: userId,
      date_worked: new Date(dateWorked).toISOString(),
      hours_worked: hoursWorked,
      reason,
      days_credited: daysCredited,
      status: "PENDING"
    })
    .select()
    .single()

  if (error) {
    console.error('CompOff Insert Error:', error)
    throw new Error(error.message)
  }

  // Log the action using admin client
  await supabaseAdmin.from('audit_logs').insert({
    user_id: userId,
    action: 'COMPOFF_WORK_LOGGED',
    entity: 'CompOffWorkEntry',
    entity_id: entry.id,
    metadata: JSON.stringify({ dateWorked, hoursWorked, daysCredited })
  })

  revalidatePath("/portal")
  return { success: true, entry }
}
