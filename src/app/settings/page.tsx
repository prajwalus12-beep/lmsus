import { getServerSession, getSupabaseServer } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { SettingsClient } from './SettingsClient'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export default async function SettingsPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const supabase = await getSupabaseServer()

  const [
    { data: closures },
    { data: adjustments },
    { data: negativeLeaves },
    { data: testModeRows },
    { data: users },
    { data: configs }
  ] = await Promise.all([
    supabase.from('leave_year_closures').select('*').order('year', { ascending: false }),
    supabase.from('leave_balance_adjustments').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('negative_leave_trackings').select('*, profiles(name)').order('created_at', { ascending: false }),
    supabase.from('system_date_overrides').select('*').order('created_at', { ascending: false }).limit(1),
    supabaseAdmin.from('profiles').select('id, name').order('name', { ascending: true }),
    supabase.from('system_configs').select('*')
  ])

  const testMode = testModeRows?.[0] || null
  const configMap = Object.fromEntries((configs || []).map((c: any) => [c.key, c.value]))
  const showClBalanceToEmployee = configMap['SHOW_CL_BALANCE_TO_EMPLOYEE'] === 'true'
  const emailEnabled = configMap['EMAIL_ENABLED'] !== 'false' // default ON if not set

  return (
    <SettingsClient
      closures={(closures || []).map((c: any) => ({
        id: c.id,
        year: c.year,
        closedAt: new Date(c.closed_at).toISOString(),
        closedBy: c.closed_by,
        status: c.status,
        remarks: c.remarks,
        carryForwardProcessed: c.carry_forward_processed
      }))}
      adjustments={(adjustments || []).map((a: any) => ({
        id: a.id,
        userId: a.user_id,
        leaveType: a.leave_type,
        amount: a.amount,
        adjustmentType: a.adjustment_type,
        reason: a.reason,
        effectiveYear: a.effective_year,
        enteredBy: a.entered_by,
        enteredByName: a.entered_by_name,
        remarks: a.remarks,
        createdAt: new Date(a.created_at).toISOString()
      }))}
      negativeLeaves={(negativeLeaves || []).map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        leaveRequestId: n.leave_request_id,
        leaveType: n.leave_type,
        negativeDays: n.negative_days,
        dailySalary: n.daily_salary,
        recoveryAmount: n.recovery_amount,
        status: n.status,
        recoveredAt: n.recovered_at ? new Date(n.recovered_at).toISOString() : null,
        remarks: n.remarks,
        userName: n.profiles?.name || 'Unknown',
        createdAt: new Date(n.created_at).toISOString(),
        updatedAt: new Date(n.updated_at).toISOString()
      }))}
      testMode={testMode ? {
        id: testMode.id,
        isTestMode: testMode.is_test_mode,
        overrideDate: testMode.override_date ? new Date(testMode.override_date).toISOString() : null,
        changedBy: testMode.changed_by,
        changedByName: testMode.changed_by_name,
        oldDate: testMode.old_date ? new Date(testMode.old_date).toISOString() : null,
        newDate: testMode.new_date ? new Date(testMode.new_date).toISOString() : null,
        reason: testMode.reason,
        createdAt: new Date(testMode.created_at).toISOString()
      } : null}
      users={users || []}
      showClBalanceToEmployee={showClBalanceToEmployee}
      emailEnabled={emailEnabled}
      initialConfigs={configMap}
    />
  )
}
