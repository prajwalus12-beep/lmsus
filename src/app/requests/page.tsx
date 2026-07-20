import { getServerSession } from '@/lib/supabaseServer'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { DataTable } from './DataTable'
import { columns, compOffColumns } from './columns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function RequestsPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const [requests, compOffs] = await Promise.all([
    prisma.leaveRequest.findMany({
      include: {
        user: {
          include: { department: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.compOffWorkEntry.findMany({
      include: {
        user: {
          include: { department: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const formattedRequests = (requests || []).map((req: any) => {
    const start = new Date(req.startDate)
    const end = new Date(req.endDate)
    const calendarDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    return {
      id: req.id,
      employeeName: req.user?.name || 'Unknown',
      employeeStatus: req.user?.status || 'ACTIVE',
      department: req.user?.department?.name || 'N/A',
      type: req.type,
      startDate: new Date(req.startDate).toLocaleDateString(),
      endDate: new Date(req.endDate).toLocaleDateString(),
      reason: req.reason,
      status: req.status,
      attachmentUrl: req.attachmentUrl,
      calendarDays
    }
  });

  const formattedCompOffs = (compOffs || []).map((co: any) => ({
    id: co.id,
    employeeName: co.user?.name || 'Unknown',
    employeeStatus: co.user?.status || 'ACTIVE',
    department: co.user?.department?.name || 'N/A',
    dateWorked: new Date(co.dateWorked).toLocaleDateString(),
    hoursWorked: co.hoursWorked,
    daysCredited: co.daysCredited,
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
