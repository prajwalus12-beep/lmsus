import { getServerSession, getSupabaseServer } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { redirect } from 'next/navigation'
import { CalendarClient } from './CalendarClient'
import { getSystemDate } from '@/lib/systemDate'

export default async function CalendarPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const sessionUser = session?.user as any;
  const sysDate = await getSystemDate()

  // Rule 27: Employees can view a read-only team calendar showing all approved leaves.
  // Use supabaseAdmin to ensure visibility of all approved leaves regardless of RLS
  const [{ data: requests }, { data: holidays }, { data: allDepts }] = await Promise.all([
    supabaseAdmin
      .from('leave_requests')
      .select('*, profiles!leave_requests_user_id_fkey(name, email, departments(name))')
      .in('status', ['HR_APPROVED', 'L1_APPROVED']),
    supabaseAdmin.from('holidays').select('*'),
    supabaseAdmin.from('departments').select('name').order('name')
  ])

  const formattedRequests = (requests || []).map((req: any) => {
    const profile = req.profiles
    const dept = Array.isArray(profile?.departments) ? profile.departments[0] : profile?.departments

    return {
      id: req.id,
      userId: req.user_id,
      title: `${profile?.name || 'Unknown'} - ${req.type}`,
      email: profile?.email || '',
      startDate: req.start_date,
      endDate: req.end_date,
      department: dept?.name || 'N/A',
      status: req.status,
    }
  });

  const formattedHolidays = (holidays || []).map((h: any) => ({
    id: h.id,
    name: h.name,
    date: h.date,
  }));

  const departments = (allDepts || []).map(d => d.name);

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team Calendar</h1>
        <p className="text-slate-500">View approved leaves and public holidays.</p>
      </div>
      
      <div className="flex-1 min-h-[600px] bg-white border rounded-xl shadow-sm overflow-hidden p-6">
        <CalendarClient 
          requests={formattedRequests} 
          holidays={formattedHolidays}
          departments={departments}
          currentUserId={sessionUser?.id}
          initialDateStr={sysDate.toISOString()}
        />
      </div>
    </div>
  )
}
