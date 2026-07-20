import { getServerSession } from '@/lib/supabaseServer'
import prisma from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, CheckCircle2, AlertCircle } from "lucide-react"
import { redirect } from "next/navigation"
import { checkAndRunLazyAccrual } from '@/lib/lazyAccrual'

export default async function DashboardPage() {
  const session = await getServerSession()
  
  if (!session) {
    redirect("/login")
  }

  // Trigger lazy monthly PL accrual check
  await checkAndRunLazyAccrual()

  if ((session?.user as any)?.role === "EMPLOYEE") {
    redirect("/portal")
  }

  // Use Prisma to ensure full team metrics for HR/Admin
  const [
    activeUsersCount,
    resignedUsersCount,
    pendingRequests,
    balances
  ] = await Promise.all([
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'RESIGNED' } }),
    prisma.leaveRequest.count({ where: { status: { in: ['PENDING', 'L1_APPROVED'] } } }),
    prisma.leaveBalance.findMany({
      where: { year: new Date().getFullYear() },
      select: { plUsed: true, clUsed: true }
    })
  ])
  
  // Calculations
  const totalPlTaken = (balances || []).reduce((acc: number, curr: any) => acc + (curr.plUsed || 0), 0);
  const totalClTaken = (balances || []).reduce((acc: number, curr: any) => acc + (curr.clUsed || 0), 0);

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
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Privilege Leave (PL) Taken</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPlTaken} days</div>
            <p className="text-xs text-slate-500 mt-1">This year</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casual Leave (CL) Taken</CardTitle>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClTaken} days</div>
            <p className="text-xs text-slate-500 mt-1">This year</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
