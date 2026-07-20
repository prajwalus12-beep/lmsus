import { getServerSession } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { SettingsClient } from './SettingsClient'
import prisma from '@/lib/prisma'

export default async function SettingsPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const [
    closures,
    adjustments,
    negativeLeaves,
    testModeRows,
    users,
    configs
  ] = await Promise.all([
    prisma.leaveYearClosure.findMany({
      orderBy: { year: 'desc' }
    }),
    prisma.leaveBalanceAdjustment.findMany({
      include: {
        user: true
      },
      orderBy: { createdAt: 'desc' },
      take: 1000
    }),
    prisma.negativeLeaveTracking.findMany({
      include: {
        user: true
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.systemDateOverride.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        department: {
          select: { name: true }
        }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.systemConfig.findMany()
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
        closedAt: c.closedAt.toISOString(),
        closedBy: c.closedBy,
        status: c.status,
        remarks: c.remarks,
        carryForwardProcessed: c.carryForwardProcessed
      }))}
      adjustments={(adjustments || []).map((a: any) => ({
        id: a.id,
        userId: a.userId,
        userName: a.user?.name || 'Unknown',
        leaveType: a.leaveType,
        amount: a.amount,
        adjustmentType: a.adjustmentType,
        reason: a.reason,
        effectiveYear: a.effectiveYear,
        enteredBy: a.enteredBy,
        enteredByName: a.enteredByName,
        remarks: a.remarks,
        createdAt: a.createdAt.toISOString()
      }))}
      negativeLeaves={(negativeLeaves || []).map((n: any) => ({
        id: n.id,
        userId: n.userId,
        leaveRequestId: n.leaveRequestId,
        leaveType: n.leaveType,
        negativeDays: n.negativeDays,
        dailySalary: n.dailySalary,
        recoveryAmount: n.recoveryAmount,
        status: n.status,
        recoveredAt: n.recoveredAt ? n.recoveredAt.toISOString() : null,
        remarks: n.remarks,
        userName: n.user?.name || 'Unknown',
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString()
      }))}
      testMode={testMode ? {
        id: testMode.id,
        isTestMode: testMode.isTestMode,
        overrideDate: testMode.overrideDate ? testMode.overrideDate.toISOString() : null,
        changedBy: testMode.changedBy,
        changedByName: testMode.changedByName,
        oldDate: testMode.oldDate ? testMode.oldDate.toISOString() : null,
        newDate: testMode.newDate ? testMode.newDate.toISOString() : null,
        reason: testMode.reason,
        createdAt: testMode.createdAt.toISOString()
      } : null}
      users={users.map((u: any) => ({
        id: u.id,
        name: u.name,
        departments: u.department ? { name: u.department.name } : null
      }))}
      showClBalanceToEmployee={showClBalanceToEmployee}
      emailEnabled={emailEnabled}
      initialConfigs={configMap}
    />
  )
}
