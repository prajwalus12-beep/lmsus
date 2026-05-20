import { PrismaClient } from '@prisma/client'
import { SettingsClient } from './SettingsClient'

const prisma = new PrismaClient()

export default async function SettingsPage() {
  const closures = await prisma.leaveYearClosure.findMany({ orderBy: { year: 'desc' } })
  const adjustments = await prisma.leaveBalanceAdjustment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  const negativeLeaves = await prisma.negativeLeaveTracking.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  })
  const testMode = await prisma.systemDateOverride.findFirst({ orderBy: { createdAt: 'desc' } })
  const users = await prisma.user.findMany({ select: { id: true, name: true } })

  // Load system configs
  const configs = await prisma.systemConfig.findMany()
  const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]))
  const showClBalanceToEmployee = configMap['SHOW_CL_BALANCE_TO_EMPLOYEE'] === 'true'

  return (
    <SettingsClient
      closures={closures.map(c => ({ ...c, closedAt: c.closedAt.toISOString() }))}
      adjustments={adjustments.map(a => ({ ...a, createdAt: a.createdAt.toISOString() }))}
      negativeLeaves={negativeLeaves.map(n => ({
        ...n,
        userName: n.user.name,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      }))}
      testMode={testMode ? {
        ...testMode,
        isTestMode: testMode.isTestMode,
        overrideDate: testMode.overrideDate?.toISOString() ?? null,
        createdAt: testMode.createdAt.toISOString(),
      } : null}
      users={users}
      showClBalanceToEmployee={showClBalanceToEmployee}
      initialConfigs={configMap}
    />
  )
}
