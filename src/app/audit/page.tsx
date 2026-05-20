import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import { AuditClient } from './AuditClient'

const prisma = new PrismaClient()

export default async function AuditPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !['ADMIN', 'MANAGER'].includes((session.user as any).role)) {
    redirect('/')
  }

  const logs = await prisma.auditLog.findMany({
    include: {
      user: {
        select: { name: true, role: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 500
  })

  const mappedLogs = logs.map(log => ({
    id: log.id,
    userName: log.user?.name || 'System',
    userRole: log.user?.role || 'SYSTEM',
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    oldValue: log.oldValue,
    newValue: log.newValue,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
    createdAt: log.createdAt.toISOString()
  }))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Audit Logs</h1>
        <p className="text-slate-500">Comprehensive trail of all transactions, adjustments, and system changes.</p>
      </div>
      <AuditClient logs={mappedLogs} />
    </div>
  )
}
