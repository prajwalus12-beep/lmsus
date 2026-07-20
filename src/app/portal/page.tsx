import { getServerSession } from '@/lib/supabaseServer'
import prisma from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { LeaveRequestForm } from "./LeaveRequestForm"
import { CompOffRequest } from "./CompOffRequest"
import { redirect } from 'next/navigation'
import { getSystemDate } from '@/lib/systemDate'
import { checkAndRunLazyAccrual } from '@/lib/lazyAccrual'

export default async function PortalPage() {
  const session = await getServerSession()
  
  if (!session?.user) {
    redirect("/login")
  }

  // Trigger lazy monthly PL accrual check
  await checkAndRunLazyAccrual()

  if (session.user.role === "ADMIN") {
    redirect("/")
  }

  const userId = session.user.id
  const systemDate = await getSystemDate()
  const currentYear = systemDate.getFullYear()

  // Use Prisma to fetch user balances, config, and requests
  const [
    balance,
    maxNegativeConfig,
    requests
  ] = await Promise.all([
    prisma.leaveBalance.findUnique({
      where: {
        userId_year: {
          userId,
          year: currentYear
        }
      }
    }),
    prisma.systemConfig.findUnique({ where: { key: 'MAX_NEGATIVE_LEAVE' } }),
    prisma.leaveRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
  ])

  let balances = balance
  if (!balances) {
    balances = {
      id: "temp-id",
      userId: userId,
      year: currentYear,
      openingPl: 0,
      openingCl: 7,
      openingComp: 0,
      pl: 0,
      cl: 7,
      sl: 7,
      comp: 0,
      lop: 0,
      mat: 0,
      plAccrued: 0,
      plUsed: 0,
      clUsed: 0,
      slUsed: 0,
      plCarryForward: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  const maxNegative = parseFloat(maxNegativeConfig?.value || "-5");

  const plAllowed = (balances.openingPl || 0) + (balances.plAccrued || 0);
  const clAllowed = balances.openingCl || 7;
  const slAllowed = 0; // SL shares the CL balance bucket

  const totalAllowed = plAllowed + clAllowed + slAllowed;
  const totalUsed = (balances.plUsed || 0) + (balances.clUsed || 0) + (balances.slUsed || 0);

  const wellnessScore = totalAllowed > 0
    ? Math.min(100, Math.max(0, 100 - (totalUsed / totalAllowed) * 100))
    : 100;

  // Map database format to frontend expected format
  const mappedBalances = {
    user_id: balances.userId,
    year: balances.year,
    opening_pl: balances.openingPl,
    opening_cl: balances.openingCl,
    opening_comp: balances.openingComp,
    pl: balances.pl,
    cl: balances.cl,
    sl: balances.sl,
    comp: balances.comp,
    pl_accrued: balances.plAccrued,
    pl_used: balances.plUsed,
    cl_used: balances.clUsed,
    sl_used: balances.slUsed,
    pl_carry_forward: balances.plCarryForward
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Portal</h1>
        <p className="text-slate-500">Manage your time off and view your balances.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2">
           <CardHeader>
             <CardTitle>Leave Balance Overview</CardTitle>
             <CardDescription>Your current entitlement for {new Date().getFullYear()}</CardDescription>
           </CardHeader>
           <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
                  <p className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider pl-1">Privilege (PL)</p>
                  <p className="text-3xl font-extrabold text-slate-900 pl-1">
                    {balances.pl % 1 === 0 ? balances.pl : parseFloat(balances.pl.toFixed(2))}
                  </p>
                </div>
                <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
                  <p className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider pl-1">Casual (CL)</p>
                  <p className="text-3xl font-extrabold text-slate-900 pl-1">
                    {balances.cl % 1 === 0 ? balances.cl : parseFloat(balances.cl.toFixed(2))}
                  </p>
                </div>
                <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                  <p className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider pl-1">Comp-Off</p>
                  <p className="text-3xl font-extrabold text-slate-900 pl-1">{balances.comp}</p>
                </div>
              </div>
           </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Wellness Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={wellnessScore} className="h-3" />
            <p className="text-sm text-slate-500">
              {wellnessScore > 80 ? "Great job! You're balancing work and rest well." : "Consider taking some time off soon."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Apply for Leave</CardTitle>
          </CardHeader>
          <CardContent>
            <LeaveRequestForm userId={userId} balances={mappedBalances} maxNegative={maxNegative} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Comp-Off Work Log</CardTitle>
          </CardHeader>
          <CardContent>
            <CompOffRequest userId={userId} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(requests || []).map((req: any) => (
              <div key={req.id} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
                <div>
                  <p className="font-semibold text-slate-900">{req.type} Leave</p>
                  <p className="text-sm text-slate-500">{new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}</p>
                  {req.attachmentUrl && (
                    <a href={req.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline mt-1 inline-block">
                      View Document
                    </a>
                  )}
                </div>
                <Badge variant={req.status === 'HR_APPROVED' ? 'default' : (req.status === 'REJECTED' ? 'destructive' : 'secondary')}>
                  {req.status}
                </Badge>
              </div>
            ))}
            {(requests || []).length === 0 && (
              <div className="text-center py-6 text-slate-500 italic">No recent requests found.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
