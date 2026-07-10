"use server"

import { getSupabaseServer, getServerSession } from "@/lib/supabaseServer"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { revalidatePath } from "next/cache"
import { calculateRequestedDays } from "@/lib/leaveCalculator"
import { sendEmail } from "@/lib/email"
import { getSystemDate } from "@/lib/systemDate"

function validateAttachmentUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:") return false;

    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    const isWhitelisted = 
      hostname === "drive.google.com" ||
      hostname === "dropbox.com" ||
      hostname.endsWith(".dropbox.com") ||
      hostname === "sharepoint.com" ||
      hostname.endsWith(".sharepoint.com") ||
      hostname === "company.com" ||
      hostname.endsWith(".company.com");

    if (!isWhitelisted) return false;

    if (hostname.includes("google.com") && (pathname.startsWith("/search") || pathname === "/")) {
      return false;
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

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
  
  // Verify session is active and check permissions
  const session = await getServerSession()
  if (!session) {
    throw new Error("Unauthorized: Not logged in.")
  }

  if (session.user.id !== userId) {
    const { data: currentUserProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    const isAuthorized = currentUserProfile && ['ADMIN', 'MANAGER'].includes(currentUserProfile.role)
    if (!isAuthorized) {
      throw new Error("Unauthorized: You do not have permission to submit leave requests on behalf of other employees.")
    }
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
  if (startObj > endObj) {
    throw new Error("Start date cannot be after end date.")
  }
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

  // 2-Day Sick Leave Document Verification Rule
  if (type === "SL" && days >= 2.0) {
    if (!attachmentUrl || attachmentUrl.trim() === "") {
      throw new Error("Cannot apply: A valid medical certificate/document URL is mandatory for Sick Leave of 2 or more days.")
    }
    if (!validateAttachmentUrl(attachmentUrl)) {
      throw new Error("Cannot apply: The document URL must be a secure link from an authorized provider (Google Drive, Dropbox, Sharepoint, or internal domain).")
    }
  }

  // 3. Adjacency Blocks (Friday-Monday and Holidays) - Only enforced for Casual Leave (CL)
  if (type === "CL") {
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
    const existingClDates = new Set<string>()
    for (const req of (existingLeaves || [])) {
      if (req.type === 'CL') {
        const dates = getDatesSet(parseAsUTCDate(req.start_date), parseAsUTCDate(req.end_date))
        for (const d of dates) {
          existingClDates.add(d)
        }
      }
    }

    const allClDates = new Set([...existingClDates, ...requestedDates])

    // Friday-Monday Adjacency Check
    for (const dateStr of requestedDates) {
      const d = parseAsUTCDate(dateStr)
      const day = d.getUTCDay() // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
      if (day === 5) {
        const mon = new Date(d)
        mon.setUTCDate(mon.getUTCDate() + 3)
        const monStr = mon.toISOString().split('T')[0]
        if (allClDates.has(monStr)) {
          throw new Error("Cannot apply: taking CL on both Friday and Monday is not allowed.")
        }
      }
      if (day === 1) {
        const fri = new Date(d)
        fri.setUTCDate(fri.getUTCDate() - 3)
        const friStr = fri.toISOString().split('T')[0]
        if (allClDates.has(friStr)) {
          throw new Error("Cannot apply: taking CL on both Friday and Monday is not allowed.")
        }
      }
    }

    // National Holiday Adjacency Check
    // 1. CL Block Sandwiched by Holidays Check
    // Group all active/requested CL dates into contiguous blocks of consecutive days
    const sortedClDates = Array.from(allClDates).sort()
    const contiguousBlocks: string[][] = []
    let currentBlock: string[] = []

    for (const dateStr of sortedClDates) {
      if (currentBlock.length === 0) {
        currentBlock.push(dateStr)
      } else {
        const lastDate = parseAsUTCDate(currentBlock[currentBlock.length - 1])
        const currentDate = parseAsUTCDate(dateStr)
        const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays === 1) {
          currentBlock.push(dateStr)
        } else {
          contiguousBlocks.push(currentBlock)
          currentBlock = [dateStr]
        }
      }
    }
    if (currentBlock.length > 0) {
      contiguousBlocks.push(currentBlock)
    }

    for (const block of contiguousBlocks) {
      // Check if this block contains any newly requested date
      const hasNewRequest = block.some(d => requestedDates.has(d))
      if (hasNewRequest) {
        // Date immediately before the block
        const firstDate = parseAsUTCDate(block[0])
        const prev = new Date(firstDate)
        prev.setUTCDate(prev.getUTCDate() - 1)
        const prevStr = prev.toISOString().split('T')[0]

        // Date immediately after the block
        const lastDate = parseAsUTCDate(block[block.length - 1])
        const next = new Date(lastDate)
        next.setUTCDate(next.getUTCDate() + 1)
        const nextStr = next.toISOString().split('T')[0]

        if (holidayDates.has(prevStr) && holidayDates.has(nextStr)) {
          throw new Error(`Cannot apply: CL cannot be sandwiched between national holidays (${prevStr} and ${nextStr}).`)
        }
      }
    }

    // 2. Holiday Sandwiched by CL Check
    // Check if any national holiday is sandwiched by CL leaves on both sides
    for (const holStr of Array.from(holidayDates)) {
      const holDate = parseAsUTCDate(holStr)
      const prev = new Date(holDate)
      prev.setUTCDate(prev.getUTCDate() - 1)
      const prevStr = prev.toISOString().split('T')[0]

      const next = new Date(holDate)
      next.setUTCDate(next.getUTCDate() + 1)
      const nextStr = next.toISOString().split('T')[0]

      if (allClDates.has(prevStr) && allClDates.has(nextStr)) {
        // Only block if at least one of these sandwiching CL dates is in the newly requested dates
        if (requestedDates.has(prevStr) || requestedDates.has(nextStr)) {
          throw new Error(`Cannot apply: National holiday (${holStr}) cannot be sandwiched between CL leaves.`)
        }
      }
    }
  }

  // 4. Backend Negative Leave Limit Validation (SL/CL mapped to cl, PL mapped to pl)
  const isPaidLeave = ['PL', 'CL', 'SL'].includes(type)
  const isCompLeave = type === 'COMP'
  
  // Fetch dynamic caps for MAT and PAT
  const [
    maternityCapRes,
    paternityCapRes
  ] = await Promise.all([
    supabaseAdmin.from('system_configs').select('value').eq('key', 'maternity_statutory_cap_days').maybeSingle(),
    supabaseAdmin.from('system_configs').select('value').eq('key', 'paternity_corporate_cap_days').maybeSingle()
  ])
  const matCap = parseInt(maternityCapRes?.data?.value || "182")
  const patCap = parseInt(paternityCapRes?.data?.value || "14")

  if (type === 'MAT' || type === 'PAT') {
    const existingTypeLeaves = existingLeaves?.filter((l: any) => l.type === type) || [];
    const usedDays = existingTypeLeaves.reduce((sum: number, l: any) => {
      const sObj = parseAsUTCDate(l.start_date);
      const eObj = parseAsUTCDate(l.end_date);
      const { days: d } = calculateRequestedDays(sObj, eObj, holidayDates, isSandwichEnabled, type, false);
      return sum + d;
    }, 0);
    const cap = type === 'MAT' ? matCap : patCap;
    if (usedDays + days > cap) {
      throw new Error(`Cannot apply: Total requested ${type === 'MAT' ? 'Maternity' : 'Paternity'} leave (${usedDays + days} days) exceeds the dynamic cap of ${cap} days.`);
    }
  }

  const activeBucket = (type === 'SL' || type === 'CL') ? 'cl' : type.toLowerCase()
  const { data: balance } = await supabaseAdmin
    .from('leave_balances')
    .select('*')
    .eq('user_id', userId)
    .single()

  const currentBalance = balance ? balance[activeBucket] || 0 : 0
  const netBalance = currentBalance - days

  if (isCompLeave && netBalance < 0) {
    throw new Error("Compensatory Off cannot go into negative balance.")
  }

  if (isPaidLeave && netBalance < maxNegativeLimit) {
    const allowedPaidDays = currentBalance - maxNegativeLimit
    if (allowedPaidDays <= 0) {
      // The employee is already at/below the max negative limit. Convert entire request to LOP!
      type = 'LOP'
    } else {
      // Split the request. First N active days as paid leave, rest as LOP.
      const allRequestDays: Date[] = []
      let curr = new Date(startObj)
      while (curr <= endObj) {
        allRequestDays.push(new Date(curr))
        curr.setUTCDate(curr.getUTCDate() + 1)
      }

      // Filter out weekends/holidays if sandwich doesn't apply
      const activeDays: Date[] = []
      for (const d of allRequestDays) {
        const dateStr = d.toISOString().split('T')[0]
        const isWe = d.getUTCDay() === 0 || d.getUTCDay() === 6
        const isHol = holidayDates.has(dateStr)
        const applySandwich = (type === "CL" || type === "PL") && isSandwichEnabled
        if (!applySandwich && (isWe || isHol)) {
          continue
        }
        activeDays.push(d)
      }

      const dayWeight = halfDay !== 'NONE' ? 0.5 : 1.0
      const daysCountNeeded = allowedPaidDays
      let paidActiveCount = 0
      let splitIndex = -1

      for (let i = 0; i < activeDays.length; i++) {
        paidActiveCount += dayWeight
        if (paidActiveCount >= daysCountNeeded) {
          splitIndex = i
          break
        }
      }

      if (splitIndex !== -1 && splitIndex < activeDays.length - 1) {
        const paidEndObj = activeDays[splitIndex]
        const unpaidStartObj = new Date(paidEndObj)
        unpaidStartObj.setUTCDate(unpaidStartObj.getUTCDate() + 1)

        const paidDaysCalc = calculateRequestedDays(startObj, paidEndObj, holidayDates, isSandwichEnabled, type, halfDay !== 'NONE')
        const paidDays = paidDaysCalc.days

        const { data: paidRequest, error: paidError } = await supabaseAdmin
          .from('leave_requests')
          .insert({
            user_id: userId,
            type: type,
            start_date: startObj.toISOString(),
            end_date: paidEndObj.toISOString(),
            half_day: halfDay,
            reason: reason + " (Paid Split)",
            status: "PENDING",
            is_negative: true,
            negative_amount: Math.abs(currentBalance - paidDays < 0 ? currentBalance - paidDays : 0),
            attachment_url: attachmentUrl || null,
            year: leaveYear,
          })
          .select()
          .single()

        if (paidError) throw new Error(paidError.message)

        const unpaidDaysCalc = calculateRequestedDays(unpaidStartObj, endObj, holidayDates, isSandwichEnabled, 'LOP', halfDay !== 'NONE')
        const unpaidDays = unpaidDaysCalc.days

        const { data: unpaidRequest, error: unpaidError } = await supabaseAdmin
          .from('leave_requests')
          .insert({
            user_id: userId,
            type: 'LOP',
            start_date: unpaidStartObj.toISOString(),
            end_date: endObj.toISOString(),
            half_day: halfDay,
            reason: reason + " (Auto-routed LOP Overage)",
            status: "PENDING",
            is_negative: false,
            negative_amount: 0,
            attachment_url: attachmentUrl || null,
            year: leaveYear,
          })
          .select()
          .single()

        if (unpaidError) throw new Error(unpaidError.message)

        // Log the action using admin client
        await supabaseAdmin.from('audit_logs').insert({
          user_id: userId,
          action: 'LEAVE_APPLIED_SPLIT',
          entity: 'LeaveRequest',
          entity_id: paidRequest.id,
          metadata: JSON.stringify({ originalType: type, paidDays, lopDays: unpaidDays, paidRequestId: paidRequest.id, lopRequestId: unpaidRequest.id })
        })

        revalidatePath("/portal")
        revalidatePath("/")
        return { success: true, request: paidRequest, split: true, message: `Request successfully split: ${paidDays} days of ${type} and ${unpaidDays} days of LOP due to exceeding negative balance limits.` }
      } else {
        type = 'LOP'
      }
    }
  }

  // Normal processing for LOP (skips limit check), or non-split PL/CL/SL
  if (!['LOP', 'MAT', 'PAT'].includes(type) && !isCompLeave && netBalance < maxNegativeLimit) {
    throw new Error(`Cannot apply: Net balance would be ${netBalance.toFixed(1)}, below the minimum allowed limit of ${maxNegativeLimit} days.`)
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
