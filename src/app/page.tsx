import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, CheckCircle2, AlertCircle } from "lucide-react"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await getServerSession()
  
  if (!session) {
    redirect("/login")
  }

  if ((session?.user as any)?.role === "EMPLOYEE") {
    redirect("/portal")
  }

  // Use supabaseAdmin to ensure full team metrics for HR/Admin
  const [
    { count: activeUsersCount },
    { count: resignedUsersCount },
    { count: pendingRequests },
    { data: balances }
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'RESIGNED'),
    supabaseAdmin.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    supabaseAdmin.from('leave_balances').select('pl_used, cl_used').eq('year', new Date().getFullYear())
  ])
  
  // 2. Calculations
  const totalPlTaken = (balances || []).reduce((acc: number, curr: any) => acc + (curr.pl_used || 0), 0);
  const totalClTaken = (balances || []).reduce((acc: number, curr: any) => acc + (curr.cl_used || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-slate-500">Overview of company leave metrics and pending tasks.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
            <Users className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsersCount ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">{resignedUsersCount ?? 0} Resigned</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <FileText className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Requires approval</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-violet-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-violet-700">Total PL Taken (Team)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-700">{totalPlTaken} days</div>
            <p className="text-xs text-slate-500 mt-1">Across all employees</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-amber-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">Total CL Taken (Team)</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{totalClTaken} days</div>
            <p className="text-xs text-slate-500 mt-1">Across all employees</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
