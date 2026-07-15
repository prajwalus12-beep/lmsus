import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { redirect } from 'next/navigation'
import { calculateRequestedDays } from '@/lib/leaveCalculator'
import { RegisterClient } from './RegisterClient'

export const dynamic = 'force-dynamic'

export default async function LeaveRegisterPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const sessionUser = session.user as any
  const isAdmin = sessionUser.role === 'ADMIN' || sessionUser.role === 'MANAGER'
  
  // Use supabaseAdmin to bypass RLS
  let query = supabaseAdmin
    .from('leave_requests')
    .select('*, profiles!leave_requests_user_id_fkey(name, departments(name)), approved_by:profiles!leave_requests_approved_by_id_fkey(name)')
    .order('created_at', { ascending: false })

  if (sessionUser.role !== 'ADMIN' && sessionUser.role !== 'MANAGER') {
    query = query.eq('user_id', sessionUser.id)
  }

  const [
    { data: requests, error },
    { data: allDepts, error: deptError }
  ] = await Promise.all([
    query,
    supabaseAdmin.from('departments').select('name').order('name')
  ])

  if (error) {
    console.error("Error fetching leave requests:", error)
  }
  if (deptError) {
    console.error("Error fetching departments:", deptError)
  }

  // Fetch holidays and config once for duration calculation
  const { data: holidays } = await supabaseAdmin.from('holidays').select('date')
  const holidayDates = new Set((holidays || []).map((h: any) => h.date.split('T')[0]))
  const { data: config } = await supabaseAdmin.from('system_configs').select('value').eq('key', 'weekend_sandwich_rule').maybeSingle()
  const isSandwichEnabled = config?.value === 'true'

  const formattedData = (requests || []).map((req: any) => {
    const { days, effectiveType } = calculateRequestedDays(
      new Date(req.start_date),
      new Date(req.end_date),
      holidayDates,
      isSandwichEnabled,
      req.type,
      req.half_day !== 'NONE'
    )

    return {
      id: req.id,
      employeeName: req.profiles?.name || 'Unknown',
      department: req.profiles?.departments?.name || 'N/A',
      type: effectiveType,
      startDate: req.start_date,
      endDate: req.end_date,
      duration: days,
      appliedAt: req.created_at,
      status: req.status,
      approvedAt: req.approved_at || null,
      approvedByName: req.approved_by?.name || '—'
    }
  })

  const departments = (allDepts || []).map((d: any) => d.name)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leave Register</h1>
        <p className="text-slate-500">Comprehensive log of all leave applications and their status.</p>
      </div>

      <RegisterClient initialRequests={formattedData} departments={departments} isAdmin={isAdmin} />
    </div>
  )
}
