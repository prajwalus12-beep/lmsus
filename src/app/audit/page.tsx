import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { AuditClient } from './AuditClient'

export default async function AuditPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')
  
  if (!['ADMIN', 'MANAGER'].includes((session.user as any).role)) {
    redirect('/')
  }

  const supabase = await getSupabaseServer()

  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select('*, profiles(name, role, status)')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error("Error fetching audit logs:", error)
  }

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
      userName: log.profiles?.name || 'System',
      userRole: log.profiles?.role || 'SYSTEM',
      userStatus: log.profiles?.status || 'ACTIVE',
      action: log.action,
      entity: log.entity,
      entityId: log.entity_id,
      oldValue: log.old_value,
      newValue: log.new_value,
      metadata: parsedMetadata,
      createdAt: new Date(log.created_at).toISOString()
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
