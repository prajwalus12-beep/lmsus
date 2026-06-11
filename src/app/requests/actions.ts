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

  // If HR approved, we need to deduct from balance
  if (status === "HR_APPROVED") {
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
    
    const leaveType = effectiveType.toLowerCase() // Use effectiveType (Rule 37)
    
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
    await sendEmail({
      to: targetEmail,
      subject: `Leave Request Approved`,
      html: `<p>Your leave from ${new Date(request.start_date).toLocaleDateString()} has been Approved.</p>`
    })
  }

  revalidatePath("/requests")
  revalidatePath("/ledger")
  return { success: true }
}

export async function rejectRequest(id: string) {
  const { error: updateError } = await supabaseAdmin
    .from('leave_requests')
    .update({ status: "REJECTED" })
    .eq('id', id)

  if (updateError) throw new Error(updateError.message)

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

  revalidatePath("/requests")
  revalidatePath("/portal")
  return { success: true }
}

export async function rejectCompOff(id: string) {
  const { error: updateError } = await supabaseAdmin
    .from('comp_off_work_entries')
    .update({ status: "REJECTED" })
    .eq('id', id)

  if (updateError) throw new Error(updateError.message)

  revalidatePath("/requests")
  return { success: true }
}
