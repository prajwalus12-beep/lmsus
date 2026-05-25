import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { calculateRequestedDays } from '@/lib/leaveCalculator'

export const dynamic = 'force-dynamic'

export default async function LeaveRegisterPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const sessionUser = session.user as any
  const whereClause = sessionUser.role === 'ADMIN' ? {} : { userId: sessionUser.id }

  const requests = await prisma.leaveRequest.findMany({
    where: whereClause,
    include: {
      user: { include: { department: true } },
      approvedBy: true
    },
    orderBy: { createdAt: 'desc' }
  })

  // Fetch holidays and config once for duration calculation
  const holidays = await prisma.holiday.findMany()
  const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))
  const config = await prisma.systemConfig.findUnique({ where: { key: 'weekend_sandwich_rule' } })
  const isSandwichEnabled = config?.value === 'true'

  const formattedData = requests.map(req => {
    const { days } = calculateRequestedDays(
      req.startDate,
      req.endDate,
      holidayDates,
      isSandwichEnabled,
      req.type,
      req.halfDay !== 'NONE'
    )

    return {
      id: req.id,
      employeeName: req.user.name,
      department: req.user.department?.name || 'N/A',
      type: req.type,
      startDate: req.startDate,
      endDate: req.endDate,
      duration: days,
      appliedAt: req.createdAt,
      status: req.status,
      approvedAt: req.approvedAt,
      approvedByName: req.approvedBy?.name || '—'
    }
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leave Register</h1>
        <p className="text-slate-500">Comprehensive log of all leave applications and their status.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Applied On</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approved At</TableHead>
                <TableHead>Approver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formattedData.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.employeeName}</div>
                    <div className="text-xs text-slate-400">{row.department}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.type}</Badge>
                  </TableCell>
                  <TableCell>{row.duration} days</TableCell>
                  <TableCell className="text-sm">
                    {row.startDate.toLocaleDateString()} - {row.endDate.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {row.appliedAt.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'HR_APPROVED' ? 'default' : (row.status === 'REJECTED' ? 'destructive' : 'secondary')}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {row.approvedAt ? row.approvedAt.toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{row.approvedByName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
