"use server"

import { getSupabaseServer, getServerSession } from "@/lib/supabaseServer"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { revalidatePath } from "next/cache"
import { calculateRequestedDays } from "@/lib/leaveCalculator"
import { sendEmail } from "@/lib/email"
import { getSystemDate } from "@/lib/systemDate"

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
  
  // Verify session matches userId
  const session = await getServerSession()
  if (!session || session.user.id !== userId) {
    throw new Error("Unauthorized: Session mismatch or not logged in.")
  }

  const parseAsUTCDate = (dateStr: string | Date) => {
    if (dateStr instanceof Date) return dateStr
    const isoStr = typeof dateStr === 'string' ? dateStr.split('T')[0] : ''
    const [y, m, d] = isoStr.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
  }

  const supabase = await getSupabaseServer()
  const startObj = parseAsUTCDate(startDate)
  const endObj = parseAsUTCDate(endDate)
  const leaveYear = startObj.getUTCFullYear()

  const yearStart = `${leaveYear}-01-01`
  const yearEnd = `${leaveYear}-12-31`

  const [
    userRes,
    holidaysRes,
    sandwichRes,
    probationRes,
    maxNegativeRes,
    existingLeavesRes
  ] = await Promise.all([
    supabase.from('profiles').select('name, email, communication_email, join_date, probation_end_date').eq('id', userId).single(),
    supabase.from('holidays').select('*').gte('date', yearStart).lte('date', yearEnd),
    supabase.from('system_configs').select('value').eq('key', 'weekend_sandwich_rule').single(),
    supabase.from('system_configs').select('value').eq('key', 'PROBATION_PERIOD_MONTHS').single(),
    supabase.from('system_configs').select('value').eq('key', 'MAX_NEGATIVE_LEAVE').maybeSingle(),
    supabaseAdmin.from('leave_requests').select('start_date, end_date, type').eq('user_id', userId).in('status', ['PENDING', 'L1_APPROVED', 'HR_APPROVED'])
  ]);

  console.log("SUBMIT DEBUG - User Query:", userRes);
  console.log("SUBMIT DEBUG - Holidays Query:", holidaysRes);
  console.log("SUBMIT DEBUG - Leaves Query:", existingLeavesRes);

  const user = userRes.data;
  const holidays = holidaysRes.data;
  const sandwichConfig = sandwichRes.data;
  const probationConfig = probationRes.data;
  const maxNegativeConfig = maxNegativeRes.data;
  const existingLeaves = existingLeavesRes.data;
  
  const probationMonths = parseInt(probationConfig?.value || "6")
  const maxNegativeLimit = parseFloat(maxNegativeConfig?.value || "-5")

  const holidayDates = new Set((holidays || []).map((h: any) => h.date.split('T')[0]))
  const isSandwichEnabled = sandwichConfig?.value === "true"

  const isHalfDay = halfDay !== "NONE"
  const { days, convertedToPl } = calculateRequestedDays(
    startObj, 
    endObj, 
    holidayDates, 
    isSandwichEnabled, 
    type, 
    isHalfDay
  )

  // Rule 37: Auto-convert CL to PL
  if (convertedToPl) {
    type = "PL"
  }

  // 1. Block Half-day for PL
  if (type === "PL" && isHalfDay) {
    throw new Error("Privilege Leave (PL) cannot be applied as a half day.")
  }

  // 2. CL & SL Duration Caps
  if (type === "CL" && days > 1.0) {
    throw new Error("Casual Leave (CL) requests are limited to a maximum of 1 day.")
  }
  if (type === "SL" && days > 2.0) {
    throw new Error("Sick Leave (SL) requests are limited to a maximum of 2 days.")
  }

  // 3. Adjacency Blocks (Friday-Monday and Holidays)
  if (type === "CL" || type === "PL") {
    const getDatesSet = (start: Date, end: Date) => {
      const dates = new Set<string>()
      let curr = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
      const finalEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
      while (curr <= finalEnd) {
        dates.add(curr.toISOString().split('T')[0])
        curr.setUTCDate(curr.getUTCDate() + 1)
      }
      return dates
    }

    const requestedDates = getDatesSet(startObj, endObj)
    const existingClPlDates = new Set<string>()
    for (const req of (existingLeaves || [])) {
      if (req.type === 'CL' || req.type === 'PL') {
        const dates = getDatesSet(parseAsUTCDate(req.start_date), parseAsUTCDate(req.end_date))
        for (const d of dates) {
          existingClPlDates.add(d)
        }
      }
    }

    const allClPlDates = new Set([...existingClPlDates, ...requestedDates])

    // Friday-Monday Adjacency Check
    for (const dateStr of requestedDates) {
      const d = parseAsUTCDate(dateStr)
      const day = d.getUTCDay() // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
      if (day === 5) {
        const mon = new Date(d)
        mon.setUTCDate(mon.getUTCDate() + 3)
        const monStr = mon.toISOString().split('T')[0]
        if (allClPlDates.has(monStr)) {
          throw new Error("Cannot apply: taking CL or PL on both Friday and Monday is not allowed.")
        }
      }
      if (day === 1) {
        const fri = new Date(d)
        fri.setUTCDate(fri.getUTCDate() - 3)
        const friStr = fri.toISOString().split('T')[0]
        if (allClPlDates.has(friStr)) {
          throw new Error("Cannot apply: taking CL or PL on both Friday and Monday is not allowed.")
        }
      }
    }

    // National Holiday Adjacency Check
    for (const dateStr of requestedDates) {
      const d = parseAsUTCDate(dateStr)
      // Check day before
      const prev = new Date(d)
      prev.setUTCDate(prev.getUTCDate() - 1)
      const prevStr = prev.toISOString().split('T')[0]
      if (holidayDates.has(prevStr)) {
        throw new Error(`Cannot apply: leave cannot be taken immediately before a national holiday (${prevStr}).`)
      }
      // Check day after
      const next = new Date(d)
      next.setUTCDate(next.getUTCDate() + 1)
      const nextStr = next.toISOString().split('T')[0]
      if (holidayDates.has(nextStr)) {
        throw new Error(`Cannot apply: leave cannot be taken immediately after a national holiday (${nextStr}).`)
      }
    }
  }

  // 4. Backend Negative Leave Limit Validation (SL/CL mapped to cl, PL mapped to pl)
  const activeBucket = (type === 'SL' || type === 'CL') ? 'cl' : type.toLowerCase()
  const { data: balance } = await supabaseAdmin
    .from('leave_balances')
    .select('*')
    .eq('user_id', userId)
    .single()

  const currentBalance = balance ? balance[activeBucket] || 0 : 0
  const netBalance = currentBalance - days
  if (netBalance < maxNegativeLimit) {
    throw new Error(`Cannot apply: Net balance would be ${netBalance.toFixed(1)}, below the minimum allowed limit of ${maxNegativeLimit} days.`)
  }
  if (type === 'COMP' && netBalance < 0) {
    throw new Error("Compensatory Off cannot go into negative balance.")
  }

  // Rule 50: Probation Check (Apply AFTER potential conversion, using system override date)
  if (type === 'PL') {
    const systemDate = await getSystemDate()
    if (user && user.probation_end_date) {
      const probationEnd = new Date(user.probation_end_date)
      if (systemDate < probationEnd) {
        throw new Error(`Privilege Leave (PL) cannot be applied during the probation period (ends ${new Date(user.probation_end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}).`)
      }
    } else if (user) {
      const probationLimit = new Date(systemDate)
      probationLimit.setMonth(probationLimit.getMonth() - probationMonths)
      if (new Date(user.join_date) > probationLimit) {
        throw new Error(`Privilege Leave (PL) cannot be applied during the ${probationMonths}-month probation period (Rule 50).`)
      }
    }
  }

  // Use supabaseAdmin to bypass RLS for insertion
  const { data: request, error: insertError } = await supabaseAdmin
    .from('leave_requests')
    .insert({
      user_id: userId,
      type,
      start_date: startObj.toISOString(),
      end_date: endObj.toISOString(),
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
  const applicantEmail = user?.communication_email || user?.email || "noreply@company.com"

  const formattedStartDate = new Date(startDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
  const formattedEndDate = new Date(endDate).toLocaleDateString('en-IN', {
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
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear ${user?.name || 'Employee'},</h2>
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
    await Promise.all(adminEmails.map((email: string) => 
      sendEmail({
        to: email,
        subject: `New Leave Application: ${user?.name} (${type})`,
          html: `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #0f172a; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear Manager/HR,</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        <strong>${user?.name}</strong> has submitted a new leave application that requires your <span style="background-color: #e2e8f0; color: #475569; padding: 4px 8px; border-radius: 4px; font-weight: 600;">review</span>.
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">LEAVE DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Employee</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${user?.name}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Leave Type</td>
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
        Please log in to the Leave Management System (LMS) to approve or reject this request.
      </p>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Best Regards,</div>
        <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">Leave Management System</div>
        <div style="color: #64748b;">Unique School India LLP</div>
      </div>
    </div>
  </div>
  <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px;">
    This is an automated notification. Please do not reply to this email.
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

  // Fetch HR and Managers for notification
  const { data: user } = await supabaseAdmin.from('profiles').select('name, email, communication_email').eq('id', userId).single()
  const { data: adminsAndManagers } = await supabaseAdmin
    .from('profiles')
    .select('email, communication_email')
    .in('role', ['ADMIN', 'MANAGER'])
    .eq('status', 'ACTIVE')

  const adminEmails = (adminsAndManagers || []).map((u: any) => u.communication_email || u.email)
  const applicantEmail = user?.communication_email || user?.email || "noreply@company.com"

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
    await Promise.all(adminEmails.map((email: string) => 
      sendEmail({
        to: email,
        subject: `New Comp-Off Logged: ${user?.name}`,
        html: `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #0f172a; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear Manager/HR,</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        <strong>${user?.name}</strong> has logged new comp-off hours that require your <span style="background-color: #e2e8f0; color: #475569; padding: 4px 8px; border-radius: 4px; font-weight: 600;">review</span>.
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">COMP-OFF DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Employee</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${user?.name}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Date Worked</td>
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
        Please log in to the Leave Management System (LMS) to approve or reject this comp-off entry.
      </p>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Best Regards,</div>
        <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">Leave Management System</div>
        <div style="color: #64748b;">Unique School India LLP</div>
      </div>
    </div>
  </div>
  <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px;">
    This is an automated notification. Please do not reply to this email.
  </div>
</div>
        `
      })
    ))
  }

  revalidatePath("/portal")
  return { success: true, entry }
  } catch (err: any) {
    console.error("submitCompOffWork Error:", err)
    return { success: false, error: err.message || "Failed to submit request." }
  }
}
