import { getServerSession } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { AuditClient } from './AuditClient'
import prisma from '@/lib/prisma'

export default async function AuditPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')
  
  if (!['ADMIN', 'MANAGER'].includes((session.user as any).role)) {
    redirect('/')
  }

  const logs = await prisma.auditLog.findMany({
    include: {
      user: true
    },
    orderBy: { createdAt: 'desc' },
    take: 500
  })

  const mappedLogs = (logs || []).map((log: any) => {
    let parsedMetadata = null
    if (log.metadata) {
      try {
        parsedMetadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata
      } catch (e) {
        parsedMetadata = { note: log.metadata }
      }
    }

    return {
      id: log.id,
      userName: log.user?.name || 'System',
      userRole: log.user?.role || 'SYSTEM',
      userStatus: log.user?.status || 'ACTIVE',
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      oldValue: log.oldValue,
      newValue: log.newValue,
      metadata: parsedMetadata,
      createdAt: log.createdAt.toISOString()
    }
  })

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
