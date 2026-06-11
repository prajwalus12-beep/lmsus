import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { redirect } from 'next/navigation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { calculateRequestedDays } from '@/lib/leaveCalculator'

export const dynamic = 'force-dynamic'

export default async function LeaveRegisterPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const sessionUser = session.user as any
  
  // Use supabaseAdmin to bypass RLS
  let query = supabaseAdmin
    .from('leave_requests')
    .select('*, profiles!leave_requests_user_id_fkey(name, departments(name)), approved_by:profiles!leave_requests_approved_by_id_fkey(name)')
    .order('created_at', { ascending: false })

  if (sessionUser.role !== 'ADMIN') {
    query = query.eq('user_id', sessionUser.id)
  }

  const { data: requests, error } = await query
  if (error) {
    console.error("Error fetching leave requests:", error)
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
      type: effectiveType, // Use effective type
      startDate: new Date(req.start_date),
      endDate: new Date(req.end_date),
      duration: days,
      appliedAt: new Date(req.created_at),
      status: req.status,
      approvedAt: req.approved_at ? new Date(req.approved_at) : null,
      approvedByName: req.approved_by?.name || '—'
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
              {formattedData.length === 0 && (
                 <TableRow>
                   <TableCell colSpan={8} className="text-center py-12 text-slate-500 italic">
                     No records found in the leave register.
                   </TableCell>
                 </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
