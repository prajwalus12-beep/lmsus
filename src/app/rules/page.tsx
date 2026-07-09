import { getServerSession, getSupabaseServer } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BookOpen, 
  CalendarDays, 
  ShieldAlert, 
  Award, 
  RefreshCw, 
  Clock, 
  AlertCircle,
  FileText,
  UserCheck,
  CheckCircle2
} from "lucide-react";

export default async function LeaveRulesPage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const supabase = await getSupabaseServer();
  const { data: configs } = await supabase.from('system_configs').select('*');
  const configMap = Object.fromEntries((configs || []).map((c: any) => [c.key, c.value]));

  const accrualRate = configMap['ACCRUAL_RATE_PL'] || "1.5";
  const accrualBase = configMap['ACCRUAL_BASE_DAYS'] || "20";
  const maxCarryForward = configMap['MAX_CARRY_FORWARD_PL'] || "30";
  const minWorkedDays = configMap['MIN_WORKED_DAYS_FOR_PL'] || "15";
  const probationMonths = configMap['PROBATION_PERIOD_MONTHS'] || "6";
  const maxNegative = configMap['MAX_NEGATIVE_LEAVE'] || "-5";
  const isSandwichEnabled = configMap['weekend_sandwich_rule'] === 'true';

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">
            <BookOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Leave Rules & Policies</h1>
            <p className="text-sm text-slate-500 mt-0.5 md:text-base">
              A comprehensive guide to entitlement types, accrual logic, and system-enforced validation rules.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Leave Types & Entitlements */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Leave Categories & Limits
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Privilege Leave */}
            <Card className="hover:shadow-md transition-shadow border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-md">PL</span>
                  <Award className="w-5 h-5 text-indigo-500" />
                </div>
                <CardTitle className="text-base mt-2">Privilege Leave (PL)</CardTitle>
                <CardDescription>Planned leaves for leisure or personal commitments.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2">
                <div className="flex justify-between border-b pb-1">
                  <span className="font-medium text-slate-800">Minimum Request:</span>
                  <span>1.0 Day (No half-days)</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="font-medium text-slate-800">Probation Rule:</span>
                  <span className="text-amber-700 font-medium">Blocked during probation</span>
                </div>
                <p className="text-xs text-slate-500 pt-1">
                  Accrues monthly on a pro-rata basis. Half-day applications are strictly restricted for PL.
                </p>
              </CardContent>
            </Card>

            {/* Casual Leave */}
            <Card className="hover:shadow-md transition-shadow border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="bg-teal-50 text-teal-700 text-xs font-semibold px-2.5 py-1 rounded-md">CL</span>
                  <Clock className="w-5 h-5 text-teal-500" />
                </div>
                <CardTitle className="text-base mt-2">Casual Leave (CL)</CardTitle>
                <CardDescription>Unplanned leaves for personal urgent matters.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2">
                <div className="flex justify-between border-b pb-1">
                  <span className="font-medium text-slate-800">Max Request:</span>
                  <span>2.0 Days per application</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="font-medium text-slate-800">Half Days:</span>
                  <span>Allowed (0.5 Days)</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="font-medium text-slate-800">Conversion Rule:</span>
                  <span className="text-indigo-600 font-medium">&gt; 2 Days converts to PL</span>
                </div>
                <p className="text-xs text-slate-500 pt-1">
                  CL requests are limited to a maximum of 2.0 days at a time. Half days (0.5 days) are allowed. Applying for more than 2 calendar days automatically converts the type to PL.
                </p>
              </CardContent>
            </Card>

            {/* Sick Leave */}
            <Card className="hover:shadow-md transition-shadow border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="bg-rose-50 text-rose-700 text-xs font-semibold px-2.5 py-1 rounded-md">SL</span>
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                </div>
                <CardTitle className="text-base mt-2">Sick Leave (SL)</CardTitle>
                <CardDescription>Leaves taken due to illness or medical needs.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2">
                <div className="flex justify-between border-b pb-1">
                  <span className="font-medium text-slate-800">Max Request:</span>
                  <span>2.0 Days per application</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="font-medium text-slate-800">Half Days:</span>
                  <span>Allowed (0.5 Days)</span>
                </div>
                <p className="text-xs text-slate-500 pt-1">
                  SL is limited to a maximum of 2.0 days at a time. Requests for more than 2 days will not be submitted. If you want SL for more than 2 days, apply as a PL instead and provide a valid document link. Supported secure storage links: Google Drive, Dropbox, Sharepoint, or internal company.com domains.
                </p>
              </CardContent>
            </Card>

            {/* Comp-Off */}
            <Card className="hover:shadow-md transition-shadow border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="bg-sky-50 text-sky-700 text-xs font-semibold px-2.5 py-1 rounded-md">COMP</span>
                  <CalendarDays className="w-5 h-5 text-sky-500" />
                </div>
                <CardTitle className="text-base mt-2">Compensatory Off (Comp-Off)</CardTitle>
                <CardDescription>Leaves earned against extra weekend/holiday work.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2">
                <div className="flex justify-between border-b pb-1">
                  <span className="font-medium text-slate-800">Earning mechanism:</span>
                  <span>Submit Comp-Off Work Entry</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="font-medium text-slate-800">Negative Limit:</span>
                  <span className="text-red-600 font-semibold">Strictly 0 (No negative)</span>
                </div>
                <p className="text-xs text-slate-500 pt-1">
                  Comp-Off credits are manually earned and approved. Unlike other leaves, they cannot go into a negative balance.
                </p>
              </CardContent>
            </Card>

            {/* Maternity & Loss of Pay */}
            <Card className="hover:shadow-md transition-shadow border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-md">MAT / LOP</span>
                  <FileText className="w-5 h-5 text-slate-400" />
                </div>
                <CardTitle className="text-base mt-2">MAT & Loss of Pay (LOP)</CardTitle>
                <CardDescription>Maternity/Paternity leaves & unpaid absences.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2">
                <div className="flex justify-between border-b pb-1">
                  <span className="font-medium text-slate-800">Maternity/Paternity:</span>
                  <span>Statutory paid duration</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="font-medium text-slate-800">Loss of Pay (LOP):</span>
                  <span>Uncapped (Unpaid)</span>
                </div>
                <p className="text-xs text-slate-500 pt-1">
                  LOP is automatically calculated or manually applied if leave requests exceed allowed negative balance thresholds.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Accrual Engine and Working Days Rules */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Section: Accruals */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin-slow" />
                <CardTitle className="text-lg">PL Monthly Accrual Rules</CardTitle>
              </div>
              <CardDescription>How Privilege Leave is credited on a monthly basis.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-4">
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mt-0.5">1</div>
                  <p>
                    <strong>Monthly Credit:</strong> PL accrues at a rate of <strong>{accrualRate} days</strong> per standard <strong>{accrualBase} base working days</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mt-0.5">2</div>
                  <p>
                    <strong>Minimum Working Days:</strong> You must have at least <strong>{minWorkedDays} worked days</strong> in the calendar month to accrue any PL. If working days fall below {minWorkedDays}, accrual for that month is <strong>0</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                  <p>
                    <strong>Formula:</strong> <code>Accrued PL = (Worked Days / {accrualBase}) * {accrualRate}</code> (up to maximum rate cap, rounded to 2 decimal places).
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                * Worked days = Total Days in Month - Weekends - Holidays - Approved Leaves.
              </p>
            </CardContent>
          </Card>

          {/* Section: System Validations */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <CardTitle className="text-lg">Policy Constraints & Restrictions</CardTitle>
              </div>
              <CardDescription>Standard rules enforced dynamically by the system.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-4">
              <div className="space-y-3.5">
                 {/* Friday-Monday Rule */}
                <div className="flex gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-xs font-semibold">
                    FM
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">Friday &amp; Monday Rule</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Applying for CL on both Friday and Monday is not allowed. Privilege Leave (PL) is allowed and bypasses this rule.
                    </p>
                  </div>
                </div>

                {/* Holiday Adjacency Rule */}
                <div className="flex gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-xs font-semibold">
                    HA
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">National Holiday Adjacency Rule</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Casual Leave (CL) is blocked if holidays sandwich the CL block on both sides (e.g. Wednesday and Friday are holidays, Thursday is CL), or if a national holiday is sandwiched by CL on both sides (e.g. Tuesday and Thursday are CL, Wednesday is holiday). Holidays on only one side are allowed. PL bypasses this rule.
                    </p>
                  </div>
                </div>

                {/* Maximum Negative Balance Rule */}
                <div className="flex gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-xs font-semibold">
                    NB
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">Negative Leave Balance Limit</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Your total net leave balance (CL/SL/PL) cannot go below <strong>{maxNegative} days</strong>. If a request pushes the balance below this limit, it is automatically blocked.
                    </p>
                  </div>
                </div>

                {/* Sandwich Rule */}
                <div className="flex gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-xs font-semibold">
                    SW
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">
                      Sandwich Rule ({isSandwichEnabled ? 'Enabled' : 'Disabled'})
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isSandwichEnabled
                        ? 'The weekend and national holiday sandwich rule is enabled. Weekends and holidays falling inside your leave duration are included and deduct from your balance.'
                        : 'The weekend and national holiday sandwich rule is disabled. Weekends and holidays falling inside your leave duration do not deduct from your balance. Only scheduled working days are debited.'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section: Probation Policy */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-lg">Probation Rules</CardTitle>
            </div>
            <CardDescription>Rules applied to newly joined employees.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-3">
            <p>
              By default, all new employees undergo a <strong>{probationMonths}-month probation period</strong> starting from their date of joining.
            </p>
            <div className="grid gap-4 md:grid-cols-2 pt-2">
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block mb-1">PL Restrictions</span>
                <p className="text-xs text-slate-500">
                  Privilege Leaves (PL) cannot be availed during probation. If your account has accrued PL, you can only request them after successfully completing probation.
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block mb-1">Allowed Leaves</span>
                <p className="text-xs text-slate-500">
                  Employees on probation can utilize Casual Leaves (CL) and Sick Leaves (SL) for urgent needs, subject to standard system checks and manager approvals.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
