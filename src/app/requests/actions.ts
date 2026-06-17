"use server"

import { getSupabaseServer, getServerSession } from "@/lib/supabaseServer"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { calculateRequestedDays } from "@/lib/leaveCalculator"
import { syncUserLedger } from "@/lib/ledgerSync"

export async function approveRequest(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error("Unauthorized")

  const userRole = session.user.role
  const approverId = session.user.id
  const status = userRole === "ADMIN" ? "HR_APPROVED" : "L1_APPROVED"

  const supabase = await getSupabaseServer()

  // Use supabaseAdmin for update to bypass RLS
  const { data: request, error: updateError } = await supabaseAdmin
    .from('leave_requests')
    .update({ 
      status,
      approved_by_id: approverId,
      approved_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('*, profiles!leave_requests_user_id_fkey(*)')
    .single()

  if (updateError || !request) {
    console.error('Approve Error:', updateError)
    throw new Error(updateError?.message || "Failed to update leave request")
  }

  // 1. Fetch holidays and config for the calculator
  const yearStart = `${new Date(request.start_date).getFullYear()}-01-01`
  const yearEnd = `${new Date(request.start_date).getFullYear()}-12-31`

  const [
    { data: holidays },
    { data: sandwichConfig }
  ] = await Promise.all([
    supabase.from('holidays').select('*').gte('date', yearStart).lte('date', yearEnd),
    supabase.from('system_configs').select('value').eq('key', 'weekend_sandwich_rule').single()
  ])

  const holidayDates = new Set((holidays || []).map((h: any) => h.date.split('T')[0]))
  const isSandwichEnabled = sandwichConfig?.value === "true"

  // 2. Calculate days
  const { days, effectiveType } = calculateRequestedDays(
    new Date(request.start_date), 
    new Date(request.end_date), 
    holidayDates, 
    isSandwichEnabled, 
    request.type, 
    request.half_day !== "NONE"
  )

  // If HR approved, we need to deduct from balance
  if (status === "HR_APPROVED") {
    const leaveType = (effectiveType || request.type).toLowerCase() // Use effectiveType (Rule 37)
    
    const { data: balance } = await supabaseAdmin
      .from('leave_balances')
      .select('*')
      .eq('user_id', request.user_id)
      .single()

    if (balance) {
      const currentVal = balance[leaveType] || 0
      const currentUsed = balance[`${leaveType}_used`] || 0
      const newVal = currentVal - days

      const { error: updateBalError } = await supabaseAdmin
        .from('leave_balances')
        .update({
          [leaveType]: newVal,
          [`${leaveType}_used`]: currentUsed + days
        })
        .eq('user_id', request.user_id)

      if (updateBalError) throw new Error(updateBalError.message)
      
      // Rule 45: Negative Leave Tracking
      if (newVal < 0) {
        // Calculate how many days of THIS request are negative
        // If currentVal was 2 and days was 5, negativeDays is 3.
        // If currentVal was -2 and days was 3, negativeDays is 3.
        const negativeDaysInThisRequest = currentVal > 0 ? Math.abs(newVal) : days

        await supabaseAdmin
          .from('negative_leave_trackings')
          .insert({
            user_id: request.user_id,
            leave_request_id: request.id,
            leave_type: request.type,
            negative_days: negativeDaysInThisRequest,
            status: 'PENDING',
            remarks: `Automatic tracking from request ${request.id}`
          })
      }

      // Keep ledger in sync
      await syncUserLedger(request.user_id, new Date(request.start_date).getFullYear())
    }
  }

  // Email logic
  const profile = request.profiles
  const targetEmail = profile?.communication_email || profile?.email
  if (targetEmail) {
    const formattedStartDate = new Date(request.start_date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
    const formattedEndDate = new Date(request.end_date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
    const totalDaysStr = days % 1 === 0 ? String(days) : days.toFixed(1)
    const approverName = session.user.name || 'HR Administrator'

    await sendEmail({
      to: targetEmail,
      subject: `Leave Request Approved`,
      html: `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #0f9d58; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear ${profile?.name || 'Employee'},</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        We are pleased to inform you that your recent leave request has been <span style="background-color: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 4px; font-weight: 600;">approved</span>.
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">APPROVED LEAVE DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Leave Type</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${request.type}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Duration</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${formattedStartDate} <span style="color: #94a3b8; font-weight: normal; margin: 0 4px;">to</span> ${formattedEndDate}</td>
        </tr>
        <tr>
          <td style="padding: 16px; color: #64748b; font-size: 14px;">Approved By</td>
          <td style="padding: 16px; color: #0f172a; font-size: 14px; font-weight: 600;">${approverName}</td>
        </tr>
      </table>
      <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 32px;">
        Please ensure your handovers and tasks are coordinated prior to your leave. Have a great rest!
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
  }

  revalidatePath("/requests")
  revalidatePath("/ledger")
  return { success: true }
}

export async function rejectRequest(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error("Unauthorized")
  const approverName = session.user.name || 'HR Administrator'

  const { data: request, error: updateError } = await supabaseAdmin
    .from('leave_requests')
    .update({ 
      status: "REJECTED",
      approved_by_id: session.user.id
    })
    .eq('id', id)
    .select('*, profiles!leave_requests_user_id_fkey(*)')
    .single()

  if (updateError || !request) throw new Error(updateError?.message || "Failed to reject leave request")

  // Send rejection email
  const profile = request.profiles
  const targetEmail = profile?.communication_email || profile?.email
  if (targetEmail) {
    const formattedStartDate = new Date(request.start_date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
    const formattedEndDate = new Date(request.end_date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })

    await sendEmail({
      to: targetEmail,
      subject: `Leave Request Rejected`,
      html: `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #c52233; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear ${profile?.name || 'Employee'},</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        We regret to inform you that your recent leave request has been <span style="background-color: #ffe4e6; color: #9f1239; padding: 4px 8px; border-radius: 4px; font-weight: 600;">rejected</span>.
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">LEAVE REQUEST DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Leave Type</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${request.type}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Duration</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${formattedStartDate} <span style="color: #94a3b8; font-weight: normal; margin: 0 4px;">to</span> ${formattedEndDate}</td>
        </tr>
        <tr>
          <td style="padding: 16px; color: #64748b; font-size: 14px;">Reviewed By</td>
          <td style="padding: 16px; color: #0f172a; font-size: 14px; font-weight: 600;">${approverName}</td>
        </tr>
      </table>
      <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 32px;">
        If you have any questions regarding this decision, please reach out to your reporting manager or get in touch directly with the <strong>HR Department</strong>.
      </p>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Best Regards,</div>
        <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">Human Resources Team</div>
        <div style="color: #64748b;">Unique School India LLP</div>
      </div>
    </div>
  </div>
  <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px;">
    This is an automated notification from the Leave Management System (LMS).<br />
    Please do not reply directly to this email.
  </div>
</div>
      `
    })
  }

  revalidatePath("/requests")
  return { success: true }
}

export async function approveCompOff(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error("Unauthorized")
  const approverId = session.user.id

  const { data: entry, error: entryError } = await supabaseAdmin
    .from('comp_off_work_entries')
    .update({ 
      status: "APPROVED",
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      approved_by_id: approverId,
      approved_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('*')
    .single()

  if (entryError || !entry) throw new Error(entryError?.message || "Failed to approve comp-off entry")

  const { data: balance, error: balError } = await supabaseAdmin
    .from('leave_balances')
    .select('comp')
    .eq('user_id', entry.user_id)
    .single()

  if (balError || !balance) throw new Error(balError?.message || "Failed to fetch leave balance")

  const { error: updateBalError } = await supabaseAdmin
    .from('leave_balances')
    .update({
      comp: (balance.comp || 0) + entry.days_credited
    })
    .eq('user_id', entry.user_id)

  if (updateBalError) throw new Error(updateBalError.message)

  // Fetch applicant profile
  const { data: profile } = await supabaseAdmin.from('profiles').select('name, email, communication_email').eq('id', entry.user_id).single()
  const targetEmail = profile?.communication_email || profile?.email || "noreply@company.com"
  const approverName = session.user.name || 'HR Administrator'

  const formattedDate = new Date(entry.date_worked).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  await sendEmail({
    to: targetEmail,
    subject: `Comp-Off Log Approved`,
    html: `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #0f9d58; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear ${profile?.name || 'Employee'},</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        We are pleased to inform you that your logged Comp-Off has been <span style="background-color: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 4px; font-weight: 600;">approved</span>.
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">APPROVED COMP-OFF DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Date Worked</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Hours Logged</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${entry.hours_worked} hrs</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Days Credited</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${entry.days_credited}</td>
        </tr>
        <tr>
          <td style="padding: 16px; color: #64748b; font-size: 14px;">Approved By</td>
          <td style="padding: 16px; color: #0f172a; font-size: 14px; font-weight: 600;">${approverName}</td>
        </tr>
      </table>
      <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 32px;">
        The comp-off days have been successfully credited to your leave balance.
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

  revalidatePath("/requests")
  revalidatePath("/portal")
  return { success: true }
}

export async function rejectCompOff(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error("Unauthorized")
  const approverName = session.user.name || 'HR Administrator'

  const { data: entry, error: updateError } = await supabaseAdmin
    .from('comp_off_work_entries')
    .update({ status: "REJECTED" })
    .eq('id', id)
    .select('*')
    .single()

  if (updateError) throw new Error(updateError.message)

  // Fetch applicant profile
  const { data: profile } = await supabaseAdmin.from('profiles').select('name, email, communication_email').eq('id', entry.user_id).single()
  const targetEmail = profile?.communication_email || profile?.email || "noreply@company.com"

  const formattedDate = new Date(entry.date_worked).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  await sendEmail({
    to: targetEmail,
    subject: `Comp-Off Log Rejected`,
    html: `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #c52233; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Dear ${profile?.name || 'Employee'},</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        We regret to inform you that your logged Comp-Off has been <span style="background-color: #ffe4e6; color: #9f1239; padding: 4px 8px; border-radius: 4px; font-weight: 600;">rejected</span>.
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">COMP-OFF DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Date Worked</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Hours Logged</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${entry.hours_worked} hrs</td>
        </tr>
        <tr>
          <td style="padding: 16px; color: #64748b; font-size: 14px;">Reviewed By</td>
          <td style="padding: 16px; color: #0f172a; font-size: 14px; font-weight: 600;">${approverName}</td>
        </tr>
      </table>
      <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 32px;">
        If you have any questions regarding this decision, please reach out to your reporting manager or get in touch directly with the <strong>HR Department</strong>.
      </p>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Best Regards,</div>
        <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">Human Resources Team</div>
        <div style="color: #64748b;">Unique School India LLP</div>
      </div>
    </div>
  </div>
  <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px;">
    This is an automated notification from the Leave Management System (LMS).<br />
    Please do not reply directly to this email.
  </div>
</div>
    `
  })

  revalidatePath("/requests")
  return { success: true }
}
