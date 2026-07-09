import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { redirect } from 'next/navigation'
import { DataTable } from './DataTable'
import { columns, compOffColumns } from './columns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function RequestsPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const [{ data: requests }, { data: compOffs }] = await Promise.all([
    supabaseAdmin.from('leave_requests')
      .select('*, profiles!leave_requests_user_id_fkey(name, status, departments(name))')
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('comp_off_work_entries')
      .select('*, profiles!comp_off_work_entries_user_id_fkey(name, status, departments(name))')
      .order('created_at', { ascending: false })
  ]);

  console.log('Admin Fetch Debug:', {
    requestsCount: requests?.length,
    compOffsCount: compOffs?.length
  });

  const formattedRequests = (requests || []).map((req: any) => {
    const start = new Date(req.start_date)
    const end = new Date(req.end_date)
    const calendarDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    return {
      id: req.id,
      employeeName: req.profiles?.name || 'Unknown',
      employeeStatus: req.profiles?.status || 'ACTIVE',
      department: req.profiles?.departments?.name || 'N/A',
      type: req.type,
      startDate: new Date(req.start_date).toLocaleDateString(),
      endDate: new Date(req.end_date).toLocaleDateString(),
      reason: req.reason,
      status: req.status,
      attachmentUrl: req.attachment_url,
      calendarDays
    }
  });

  const formattedCompOffs = (compOffs || []).map((co: any) => ({
    id: co.id,
    employeeName: co.profiles?.name || 'Unknown',
    employeeStatus: co.profiles?.status || 'ACTIVE',
    department: co.profiles?.departments?.name || 'N/A',
    dateWorked: new Date(co.date_worked).toLocaleDateString(),
    hoursWorked: co.hours_worked,
    daysCredited: co.days_credited,
    reason: co.reason,
    status: co.status
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Requests & Approvals</h1>
        <p className="text-slate-500">Manage pending leave requests and comp-off work entries.</p>
      </div>
      
      <Tabs defaultValue="leaves">
        <TabsList className="mb-4">
          <TabsTrigger value="leaves">Leave Requests</TabsTrigger>
          <TabsTrigger value="compoff">Comp-Off Work Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="leaves">
          <div className="bg-white border rounded-xl shadow-sm">
            <DataTable columns={columns} data={formattedRequests} />
          </div>
        </TabsContent>
        <TabsContent value="compoff">
          <div className="bg-white border rounded-xl shadow-sm">
            <DataTable columns={compOffColumns} data={formattedCompOffs} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
