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
  const minWorkedDays = configMap['min_working_days_threshold'] || configMap['MIN_WORKED_DAYS_FOR_PL'] || "5";
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
            <Card className="hover:shadow-md transition-shadow border-slate-200/80 bg-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
              <CardHeader className="pb-3 pl-7">
                <div className="flex items-center justify-between">
                  <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded">PL</span>
                  <Award className="w-5 h-5 text-indigo-500" />
                </div>
                <CardTitle className="text-base mt-2 font-bold text-slate-900">Privilege Leave (PL)</CardTitle>
                <CardDescription className="text-xs text-slate-500">Planned leaves for leisure or personal commitments.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2 pl-7">
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-medium text-slate-700">Minimum Request:</span>
                  <span className="text-slate-900">1.0 Day (No half-days)</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-medium text-slate-700">Probation Rule:</span>
                  <span className="text-amber-700 font-semibold">Blocked during probation</span>
                </div>
                <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                  Accrues monthly on a pro-rata basis. Half-day applications are strictly restricted for PL.
                </p>
              </CardContent>
            </Card>

            {/* Casual & Sick Leave */}
            <Card className="hover:shadow-md transition-shadow border-slate-200/80 bg-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500" />
              <CardHeader className="pb-3 pl-7">
                <div className="flex items-center justify-between">
                  <span className="bg-teal-50 text-teal-700 text-xs font-semibold px-2 py-0.5 rounded">CL / SL</span>
                  <Clock className="w-5 h-5 text-teal-500" />
                </div>
                <CardTitle className="text-base mt-2 font-bold text-slate-900">Casual &amp; Sick Leave (CL/SL)</CardTitle>
                <CardDescription className="text-xs text-slate-500">Urgent unplanned absences and medical needs.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2 pl-7">
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-medium text-slate-700">Shared Balance:</span>
                  <span className="text-slate-900">Deducts from CL bucket</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-medium text-slate-700">CL Limit:</span>
                  <span className="text-slate-900">1.0 Day per application</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-medium text-slate-700">SL Limit:</span>
                  <span className="text-slate-900">2.0 Days (Certificate for &ge; 2 days)</span>
                </div>
                <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                  CL and SL share a single combined balance bucket. Both half days (0.5) and full days are allowed.
                </p>
              </CardContent>
            </Card>

            {/* Comp-Off */}
            <Card className="hover:shadow-md transition-shadow border-slate-200/80 bg-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500" />
              <CardHeader className="pb-3 pl-7">
                <div className="flex items-center justify-between">
                  <span className="bg-sky-50 text-sky-700 text-xs font-semibold px-2 py-0.5 rounded">COMP</span>
                  <CalendarDays className="w-5 h-5 text-sky-500" />
                </div>
                <CardTitle className="text-base mt-2 font-bold text-slate-900">Compensatory Off (Comp-Off)</CardTitle>
                <CardDescription className="text-xs text-slate-500">Leaves earned against extra weekend/holiday work.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2 pl-7">
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-medium text-slate-700">Earning mechanism:</span>
                  <span className="text-slate-900">Submit Work Entry</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-medium text-slate-700">Validity:</span>
                  <span className="text-amber-700 font-semibold">Expires in 90 days</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-medium text-slate-700">Negative Balance:</span>
                  <span className="text-red-600 font-semibold">Strictly 0 (Forbidden)</span>
                </div>
                <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                  Comp-Off balances are hard-capped. Approved Comp-Off credits expire automatically after 90 days if unused.
                </p>
              </CardContent>
            </Card>

            {/* Maternity & Loss of Pay */}
            <Card className="hover:shadow-md transition-shadow border-slate-200/80 bg-white relative overflow-hidden md:col-span-2 lg:col-span-1">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-500" />
              <CardHeader className="pb-3 pl-7">
                <div className="flex items-center justify-between">
                  <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded">MAT / LOP</span>
                  <FileText className="w-5 h-5 text-slate-400" />
                </div>
                <CardTitle className="text-base mt-2 font-bold text-slate-900">Maternity, Paternity & LOP</CardTitle>
                <CardDescription className="text-xs text-slate-500">Maternity/Paternity leaves & unpaid absences.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2 pl-7">
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-medium text-slate-700">Maternity (MAT):</span>
                  <span className="text-slate-900">182 Days Cap (Paid)</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-medium text-slate-700">Paternity (PAT):</span>
                  <span className="text-slate-900">14 Days Cap (Paid)</span>
                </div>
                <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                  LOP is uncapped and unpaid. Standard leave requests that exceed negative thresholds are automatically split and routed to LOP.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Accrual Engine and Working Days Rules */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Section: Accruals */}
          <Card className="border-slate-200/80 bg-white relative overflow-hidden shadow-sm">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
            <CardHeader className="pl-7">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin-slow" />
                <CardTitle className="text-lg font-bold text-slate-900">PL Monthly Accrual Rules</CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">How Privilege Leave is credited on a monthly basis.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-4 pl-7">
              <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold mt-0.5 shrink-0">1</div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Monthly Credit:</strong> PL accrues at a rate of <strong>{accrualRate} days</strong> per standard <strong>{accrualBase} base working days</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold mt-0.5 shrink-0">2</div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Minimum Working Days:</strong> You must have at least <strong>{minWorkedDays} worked days</strong> in the calendar month to accrue any PL. If working days fall below {minWorkedDays}, accrual for that month is <strong>0</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold mt-0.5 shrink-0">3</div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Formula:</strong> <code>Accrued PL = (Worked Days / {accrualBase}) * {accrualRate}</code> (up to maximum rate cap, rounded to 2 decimal places).
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 italic">
                * Worked days = Total Days in Month - Weekends - Holidays - Approved Leaves.
              </p>
            </CardContent>
          </Card>

          {/* Section: System Validations */}
          <Card className="border-slate-200/80 bg-white relative overflow-hidden shadow-sm">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
            <CardHeader className="pl-7">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <CardTitle className="text-lg font-bold text-slate-900">Policy Constraints & Restrictions</CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">Standard rules enforced dynamically by the system.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-4 pl-7">
              <div className="space-y-4">
                 {/* Friday-Monday Rule */}
                <div className="flex gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-xs font-bold">
                    FM
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">Friday &amp; Monday Rule</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Applying for CL on both Friday and Monday is not allowed. Privilege Leave (PL) is allowed and bypasses this rule.
                    </p>
                  </div>
                </div>

                {/* Holiday Adjacency Rule */}
                <div className="flex gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-xs font-bold">
                    HA
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">National Holiday Adjacency Rule</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Casual Leave (CL) is blocked if holidays sandwich the CL block on both sides, or if a national holiday is sandwiched by CL on both sides. PL bypasses this rule.
                    </p>
                  </div>
                </div>

                {/* Maximum Negative Balance Rule */}
                <div className="flex gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-xs font-bold">
                    NB
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">Negative Leave Balance Limit</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Your total net leave balance (CL/SL/PL) cannot go below <strong>{maxNegative} days</strong>. If a request pushes the balance below this limit, it is automatically blocked.
                    </p>
                  </div>
                </div>

                {/* Sandwich Rule */}
                <div className="flex gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-xs font-bold">
                    SW
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">
                      Sandwich Rule ({isSandwichEnabled ? 'Enabled' : 'Disabled'})
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
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
        <Card className="border-slate-200/80 bg-white relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-400" />
          <CardHeader className="pl-7">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-slate-700" />
              <CardTitle className="text-lg font-bold text-slate-900">Probation Rules</CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500">Rules applied to newly joined employees.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-3 pl-7">
            <p className="text-xs text-slate-600">
              By default, all new employees undergo a <strong>{probationMonths}-month probation period</strong> starting from their date of joining.
            </p>
            <div className="grid gap-4 md:grid-cols-2 pt-2">
              <div className="p-4 bg-white rounded-xl border border-slate-200/70 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block mb-1 pl-1">PL Restrictions</span>
                <p className="text-xs text-slate-500 leading-relaxed pl-1">
                  Privilege Leaves (PL) cannot be availed during probation. If your account has accrued PL, you can only request them after successfully completing probation.
                </p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200/70 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block mb-1 pl-1">Allowed Leaves</span>
                <p className="text-xs text-slate-500 leading-relaxed pl-1">
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
