import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabaseServer"
import { getSystemDate } from "@/lib/systemDate"

export async function GET(request: Request) {
  try {
    const today = await getSystemDate()
    const todayStr = today.toISOString()
    const supabase = await getSupabaseServer()

    // Find all APPROVED comp-off entries that have expired and haven't been marked as EXPIRED yet
    const { data: expiredEntries, error: entriesError } = await supabase
      .from('comp_off_work_entries')
      .select('*')
      .eq('status', 'APPROVED')
      .lt('expiry_date', todayStr)

    if (entriesError) throw new Error(entriesError.message)

    if (!expiredEntries || expiredEntries.length === 0) {
      return NextResponse.json({ success: true, message: "No expired comp-offs found" })
    }

    let expiredCount = 0

    // For each expired entry, deduct from COMP balance and mark entry as EXPIRED.
    for (const entry of expiredEntries) {
      const { data: balance, error: balError } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', entry.user_id)
        .single()

      if (balError) {
        console.error(`Error fetching balance for user ${entry.user_id}:`, balError)
        continue
      }

      if (balance && balance.comp > 0) {
        const deductAmount = Math.min(entry.days_credited, balance.comp)

        // Mark comp-off work entry as EXPIRED
        await supabase
          .from('comp_off_work_entries')
          .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
          .eq('id', entry.id)

        // Deduct from balance
        await supabase
          .from('leave_balances')
          .update({ 
            comp: balance.comp - deductAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', balance.id)

        // Log in audit log
        await supabase
          .from('audit_logs')
          .insert({
            user_id: entry.user_id,
            action: "COMP_OFF_EXPIRED",
            entity: "CompOffWorkEntry",
            entity_id: entry.id,
            old_value: String(balance.comp),
            new_value: String(balance.comp - deductAmount),
            metadata: JSON.stringify({ reason: "Cron auto-expiry", daysCredited: entry.days_credited })
          })

        expiredCount++
      } else {
        // If they have 0 balance, just mark it as EXPIRED
        await supabase
          .from('comp_off_work_entries')
          .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
          .eq('id', entry.id)
      }
    }

    return NextResponse.json({ success: true, count: expiredCount })
  } catch (err: any) {
    console.error("Cron Error:", err)
    return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 })
  }
}
