import prisma from '@/lib/prisma'
import { DataTable } from './DataTable'
import { columns, compOffColumns } from './columns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function RequestsPage() {
  const [requests, compOffs] = await Promise.all([
    prisma.leaveRequest.findMany({
      include: {
        user: { include: { department: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.compOffWorkEntry.findMany({
      include: {
        user: { include: { department: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const formattedRequests = requests.map(req => ({
    id: req.id,
    employeeName: req.user.name,
    department: req.user.department?.name || 'N/A',
    type: req.type,
    startDate: req.startDate.toLocaleDateString(),
    endDate: req.endDate.toLocaleDateString(),
    reason: req.reason,
    status: req.status,
    attachmentUrl: req.attachmentUrl
  }));

  const formattedCompOffs = compOffs.map(co => ({
    id: co.id,
    employeeName: co.user.name,
    department: co.user.department?.name || 'N/A',
    dateWorked: co.dateWorked.toLocaleDateString(),
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
