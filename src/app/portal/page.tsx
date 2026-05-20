import prisma from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { LeaveRequestForm } from "./LeaveRequestForm"
import { CompOffRequest } from "./CompOffRequest"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export default async function PortalPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    return <div className="p-8 text-center">Not authenticated. Please log in.</div>;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { balances: true, requests: { orderBy: { createdAt: 'desc' } } }
  });

  const maxNegativeConfig = await prisma.systemConfig.findUnique({
    where: { key: 'MAX_NEGATIVE_LEAVE' }
  });
  const maxNegative = parseFloat(maxNegativeConfig?.value || "-5");

  if (!user || !user.balances) return <div className="p-8 text-center text-red-500">User balances not found. Contact HR.</div>;

  const totalAllowed = 14 + 14 + 5; 
  const totalUsed = (30 - user.balances.pl) + (14 - (user.balances.cl + user.balances.sl));
  const wellnessScore = Math.max(0, 100 - (totalUsed / totalAllowed) * 100);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Portal</h1>
        <p className="text-slate-500">Manage your time off and view your balances.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Render logic preserved... */}
        <Card className="col-span-1 md:col-span-2">
           <CardHeader>
             <CardTitle>Leave Balance Overview</CardTitle>
             <CardDescription>Your current entitlement for {new Date().getFullYear()}</CardDescription>
           </CardHeader>
           <CardContent>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <p className="text-xs text-indigo-600 font-semibold mb-1 uppercase tracking-wider">Privilege (PL)</p>
                  <p className="text-3xl font-bold text-indigo-700">{user.balances.pl}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-xs text-amber-600 font-semibold mb-1 uppercase tracking-wider">Casual (CL)</p>
                  <p className="text-3xl font-bold text-amber-700">{user.balances.cl}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs text-blue-600 font-semibold mb-1 uppercase tracking-wider">Sick (SL)</p>
                  <p className="text-3xl font-bold text-blue-700">{user.balances.sl}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-semibold mb-1 uppercase tracking-wider">Comp-Off</p>
                  <p className="text-3xl font-bold text-emerald-700">{user.balances.comp}</p>
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
            <LeaveRequestForm userId={user.id} balances={user.balances} maxNegative={maxNegative} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Comp-Off Work Log</CardTitle>
          </CardHeader>
          <CardContent>
            <CompOffRequest userId={user.id} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {user.requests.map((req) => (
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
