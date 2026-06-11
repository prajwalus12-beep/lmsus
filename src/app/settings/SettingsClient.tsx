"use client"

import { useState } from "react"
import { useSignOut } from "@/components/providers/AuthProvider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { 
  Lock, AlertTriangle, Clock, Calculator, FlaskConical,
  PlusCircle, MinusCircle, History, ShieldAlert, Eye, EyeOff, BookOpen, RefreshCcw, Shield, Loader2
} from "lucide-react"


export function SettingsClient({ closures, adjustments, negativeLeaves, testMode, users, showClBalanceToEmployee, initialConfigs }: any) {
  const signOut = useSignOut()
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0])
  const [isTestMode, setIsTestMode] = useState(testMode?.isTestMode ?? false)
  const [adjUserId, setAdjUserId] = useState("")
  const [adjType, setAdjType] = useState("PL")
  const [adjAmount, setAdjAmount] = useState("")
  const [adjReason, setAdjReason] = useState("")
  const [adjKind, setAdjKind] = useState("POSITIVE")
  const [closing, setClosing] = useState(false)
  const [clBalanceVisible, setClBalanceVisible] = useState<boolean>(showClBalanceToEmployee ?? false)
  const [savingClSetting, setSavingClSetting] = useState(false)
  const [accrualMonth, setAccrualMonth] = useState(new Date().getMonth().toString())
  const [accrualYear, setAccrualYear] = useState(new Date().getFullYear().toString())
  const [runningAccrual, setRunningAccrual] = useState(false)
  
  // New config states
  const [accrualRate, setAccrualRate] = useState(initialConfigs?.['ACCRUAL_RATE_PL'] || "1.5")
  const [accrualBase, setAccrualBase] = useState(initialConfigs?.['ACCRUAL_BASE_DAYS'] || "20")
  const [maxCarryForward, setMaxCarryForward] = useState(initialConfigs?.['MAX_CARRY_FORWARD_PL'] || "30")
  const [minWorkedDays, setMinWorkedDays] = useState(initialConfigs?.['MIN_WORKED_DAYS_FOR_PL'] || "15")
  const [probationMonths, setProbationMonths] = useState(initialConfigs?.['PROBATION_PERIOD_MONTHS'] || "6")
  const [maxNegative, setMaxNegative] = useState(initialConfigs?.['MAX_NEGATIVE_LEAVE'] || "-5")
  const [savingGlobalConfigs, setSavingGlobalConfigs] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleCloseYear = async () => {
    if (!confirm("Are you sure you want to close the year 2026? This will reset CL/SL and carry forward PL. This action is irreversible.")) return
    setClosing(true)
    try {
      const res = await fetch('/api/leave/closure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: 2026, remarks: "Routine year-end closure" }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Leave Year 2026 has been closed. Carry-forward balances generated for 2027.")
      } else {
        toast.error(data.error || "Failed to close year")
      }
    } catch (err) {
      toast.error("Network error during closure")
    } finally {
      setClosing(false)
    }
  }

  const handleAdjustment = async () => {
    if (!adjUserId || !adjAmount || !adjReason) {
      toast.error("Please fill all required fields")
      return
    }
    
    const amount = parseFloat(adjAmount)
    const finalAmount = adjKind === 'NEGATIVE' ? -Math.abs(amount) : Math.abs(amount)

    try {
      const res = await fetch('/api/leave/adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: adjUserId,
          leaveType: adjType,
          amount: finalAmount,
          adjustmentType: adjKind === 'POSITIVE' || adjKind === 'NEGATIVE' ? 'AUDIT' : adjKind,
          reason: adjReason,
          effectiveYear: new Date().getFullYear(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Adjustment recorded for selected employee.`)
        setAdjAmount(""); setAdjReason("")
      } else {
        toast.error(data.error || "Failed to record adjustment")
      }
    } catch (err) {
      toast.error("Network error during adjustment")
    }
  }

  const handleSaveGlobalConfigs = async () => {
    setSavingGlobalConfigs(true)
    try {
      const configs = [
        { key: 'ACCRUAL_RATE_PL', value: accrualRate },
        { key: 'ACCRUAL_BASE_DAYS', value: accrualBase },
        { key: 'MAX_CARRY_FORWARD_PL', value: maxCarryForward },
        { key: 'MIN_WORKED_DAYS_FOR_PL', value: minWorkedDays },
        { key: 'PROBATION_PERIOD_MONTHS', value: probationMonths },
        { key: 'MAX_NEGATIVE_LEAVE', value: maxNegative },
      ]

      await Promise.all(configs.map(c => 
        fetch('/api/leave/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(c),
        })
      ))
      toast.success("Global configurations saved successfully.")
    } catch (err) {
      toast.error("Failed to save some configurations.")
    } finally {
      setSavingGlobalConfigs(false)
    }
  }

  const handleSaveClSetting = async () => {
    setSavingClSetting(true)
    try {
      const res = await fetch('/api/leave/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'SHOW_CL_BALANCE_TO_EMPLOYEE',
          value: String(clBalanceVisible),
          description: 'Whether employees can see their CL running balance in the Leave Ledger',
        }),
      })
      if (res.ok) {
        toast.success(`CL balance visibility ${clBalanceVisible ? 'enabled' : 'disabled'} for employees.`)
      } else {
        toast.error('Failed to save setting')
      }
    } finally {
      setSavingClSetting(false)
    }
  }

  const handleResetToSeed = async () => {
    if (!confirm("CRITICAL WARNING: This will delete ALL current transactions, requests, and adjustments and restore the system to its initial seed state. This cannot be undone. You will be logged out. Proceed?")) return
    
    setResetting(true)
    try {
      const res = await fetch("/api/admin/reset-to-seed", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        toast.success("System reset successful. Logging out...")
        setTimeout(() => {
          signOut()  // Use Supabase signOut (global scope set in AuthProvider)
        }, 2000)
      } else {
        toast.error(data.error || "Reset failed")
      }
    } catch (err) {
      toast.error("Network error during reset")
    } finally {
      setResetting(false)
    }
  }

  // Stub for test mode scenario simulation
  const handleSimulate = async (scenario: string) => {
    toast.info(`Simulating: ${scenario} (not yet implemented)`)
  }

  const handleRunAccrual = async () => {
    if (!confirm(`Are you sure you want to run PL Accrual for ${new Date(parseInt(accrualYear), parseInt(accrualMonth)).toLocaleString('default', { month: 'long' })} ${accrualYear}?`)) return
    setRunningAccrual(true)
    try {
      const res = await fetch('/api/leave/accrual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: parseInt(accrualMonth), year: parseInt(accrualYear) }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Accrual completed for ${data.results.length} employees.`)
      } else {
        toast.error(data.error || 'Failed to run accrual')
      }
    } catch (err) {
      toast.error('Network error during accrual')
    } finally {
      setRunningAccrual(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings & Admin Controls</h1>
        <p className="text-slate-500">System maintenance, policies, year-end closure, and manual adjustments.</p>
      </div>

      <Tabs defaultValue="yearend">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="yearend"><Lock className="w-4 h-4 mr-2" />Year-End Closure</TabsTrigger>
          <TabsTrigger value="policy"><ShieldAlert className="w-4 h-4 mr-2" />Policy Config</TabsTrigger>
          <TabsTrigger value="adjustments"><Calculator className="w-4 h-4 mr-2" />Manual Adjustments</TabsTrigger>
          <TabsTrigger value="maintenance"><Shield className="w-4 h-4 mr-2" />Maintenance</TabsTrigger>
          <TabsTrigger value="negative"><AlertTriangle className="w-4 h-4 mr-2" />Negative Leave</TabsTrigger>
          <TabsTrigger value="testmode"><FlaskConical className="w-4 h-4 mr-2" />Test / Simulation</TabsTrigger>
          <TabsTrigger value="ledgersettings"><BookOpen className="w-4 h-4 mr-2" />Ledger Settings</TabsTrigger>
        </TabsList>

        {/* ── Year-End Closure Tab ── */}
        <TabsContent value="yearend" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <ShieldAlert className="w-5 h-5" /> Close Leave Year 2026
                </CardTitle>
                <CardDescription className="text-amber-700">
                  This is irreversible. Employees will not be able to apply, modify or cancel leaves in the closed year.
                  Carry-forward will be auto-calculated (max 30 days PL). CL/SL will lapse to zero.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Remarks (optional)</Label>
                  <Textarea placeholder="e.g. Routine year-end closure for FY 2026" />
                </div>
                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleCloseYear}
                  disabled={closing}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {closing ? "Processing..." : "Close Year 2026 & Generate 2027 Opening Balances"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" /> Closure History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {closures.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Lock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No years closed yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Closed At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closures.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-semibold">{c.year}</TableCell>
                          <TableCell><Badge variant="destructive">{c.status}</Badge></TableCell>
                          <TableCell className="text-sm text-slate-500">{new Date(c.closedAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Policy Configuration Tab ── */}
        <TabsContent value="policy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Leave Policies</CardTitle>
              <CardDescription>Configure accrual rates, base working days, and probation rules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>PL Accrual Rate (days per month)</Label>
                  <Input type="number" step="0.1" value={accrualRate} onChange={e => setAccrualRate(e.target.value)} />
                  <p className="text-xs text-slate-500">Default: 1.5</p>
                </div>
                <div className="space-y-2">
                  <Label>Accrual Base Working Days</Label>
                  <Input type="number" value={accrualBase} onChange={e => setAccrualBase(e.target.value)} />
                  <p className="text-xs text-slate-500">Used for pro-rata: (Worked / Base) * Rate. Default: 20</p>
                </div>
                <div className="space-y-2">
                  <Label>Max PL Carry Forward (days)</Label>
                  <Input type="number" value={maxCarryForward} onChange={e => setMaxCarryForward(e.target.value)} />
                  <p className="text-xs text-slate-500">Default: 30</p>
                </div>
                <div className="space-y-2">
                  <Label>Min Worked Days for Eligibility</Label>
                  <Input type="number" value={minWorkedDays} onChange={e => setMinWorkedDays(e.target.value)} />
                  <p className="text-xs text-slate-500">Must work at least these many days to get any PL. Default: 15</p>
                </div>
                <div className="space-y-2">
                  <Label>Probation Period (months)</Label>
                  <Input type="number" value={probationMonths} onChange={e => setProbationMonths(e.target.value)} />
                  <p className="text-xs text-slate-500">PL cannot be applied during this period. Default: 6</p>
                </div>
                <div className="space-y-2">
                  <Label>Max Allowed Negative Balance</Label>
                  <Input type="number" value={maxNegative} onChange={e => setMaxNegative(e.target.value)} />
                  <p className="text-xs text-slate-500">Example: -5. Default: -5</p>
                </div>
              </div>
              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700" 
                onClick={handleSaveGlobalConfigs}
                disabled={savingGlobalConfigs}
              >
                {savingGlobalConfigs ? "Saving..." : "Save Policy Configuration"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── System Maintenance Tab ── */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Danger Zone: System Reset
              </CardTitle>
              <CardDescription className="text-red-600">
                These actions are destructive and intended for testing/demo purposes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-white rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">Reset to Seed State</h4>
                <p className="text-sm text-slate-600 mb-4">
                  This will delete all current leave requests, adjustments, and transactions. 
                  The system will be restored to the "mirror" state captured at initialization.
                </p>
                <Button 
                  variant="destructive" 
                  className="w-full flex items-center justify-center gap-2"
                  onClick={handleResetToSeed}
                  disabled={resetting}
                >
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                  Wipe Data & Restore from Seed
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adjustments" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>New Adjustment Entry</CardTitle>
                <CardDescription>
                  Adjustments are appended separately from system-calculated values. Original balances remain immutable.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Employee *</Label>
                  <Select value={adjUserId} onValueChange={(v) => v && setAdjUserId(v)}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Leave Type *</Label>
                    <Select value={adjType} onValueChange={(v) => v && setAdjType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["PL", "CL", "SL", "COMP"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Adjustment Type *</Label>
                    <Select value={adjKind} onValueChange={(v) => v && setAdjKind(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POSITIVE">+ Positive</SelectItem>
                        <SelectItem value="NEGATIVE">- Negative</SelectItem>
                        <SelectItem value="CARRY_FORWARD_CORRECTION">Carry-Forward Correction</SelectItem>
                        <SelectItem value="MIGRATION">Migration Entry</SelectItem>
                        <SelectItem value="AUDIT">Audit Correction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Amount (days) *</Label>
                  <Input type="number" step="0.5" placeholder="e.g. 2" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Reason / Remarks *</Label>
                  <Textarea placeholder="Mandatory: explain the reason for this adjustment..." value={adjReason} onChange={e => setAdjReason(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleAdjustment}>
                  <PlusCircle className="w-4 h-4 mr-2" /> Record Adjustment
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Adjustment Audit Trail</CardTitle>
                <CardDescription>Append-only. No hard deletions allowed.</CardDescription>
              </CardHeader>
              <CardContent>
                {adjustments.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Calculator className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No adjustments recorded yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adjustments.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.enteredByName}</TableCell>
                          <TableCell><Badge variant="outline">{a.leaveType}</Badge></TableCell>
                          <TableCell className={a.amount < 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                            {a.amount > 0 ? "+" : ""}{a.amount}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500 truncate max-w-[120px]">{a.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Negative Leave Tab ── */}
        <TabsContent value="negative">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MinusCircle className="w-5 h-5 text-red-500" /> Negative Leave Tracker
              </CardTitle>
              <CardDescription>
                Employees with negative balances are flagged here. On resignation, recovery amounts are auto-calculated.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {negativeLeaves.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="font-medium">No negative leave balances</p>
                  <p className="text-sm mt-1">All employee balances are currently positive.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Negative Days</TableHead>
                      <TableHead>Daily Salary</TableHead>
                      <TableHead>Recovery Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {negativeLeaves.map((n: any) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-medium">{n.userName}</TableCell>
                        <TableCell><Badge variant="outline">{n.leaveType}</Badge></TableCell>
                        <TableCell className="text-red-600 font-bold">{n.negativeDays}</TableCell>
                        <TableCell>₹{n.dailySalary.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="font-semibold text-red-700">₹{n.recoveryAmount.toLocaleString('en-IN')}</TableCell>
                        <TableCell>
                          <Badge variant={n.status === 'RECOVERED' ? 'default' : 'secondary'}>{n.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Test / Simulation Mode Tab ── */}
        <TabsContent value="testmode">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className={isTestMode ? "border-indigo-400 bg-indigo-50" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5" /> Test Mode / Date Override
                </CardTitle>
                <CardDescription>
                  Rule 42: In test mode, system date is manually overridden. In production, server date is always used.
                  All test-mode actions are audit-logged.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <span className="font-medium text-sm">Test Mode</span>
                  <Button
                    variant={isTestMode ? "destructive" : "default"}
                    size="sm"
                    onClick={async () => {
                      const nextMode = !isTestMode
                      try {
                        const res = await fetch('/api/leave/test-mode', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ enabled: nextMode, date: nextMode ? testDate : null }),
                        })
                        const data = await res.json()
                        if (data.success) {
                           setIsTestMode(data.isTestMode)
                           toast[nextMode ? 'success' : 'warning'](
                             nextMode ? "Test mode ENABLED. System date can now be overridden." : "Test mode DISABLED. Production date restored."
                           )
                        } else {
                           toast.error("Failed to toggle test mode")
                        }
                      } catch (err) {
                        toast.error("Network error toggling test mode")
                      }
                    }}
                  >
                    {isTestMode ? "Disable Test Mode" : "Enable Test Mode"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Override System Date</Label>
                  <Input
                    type="date"
                    value={testDate}
                    onChange={e => setTestDate(e.target.value)}
                    disabled={!isTestMode}
                  />
                  <p className="text-xs text-slate-500">Current server date: {new Date().toLocaleDateString()}</p>
                </div>

                <div className="space-y-2">
                  <Label>Simulate Scenario</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      "Month-end PL Accrual",
                      "Year-end Carry Forward",
                      "Year-end Expiry (CL/SL)",
                      "Comp-off Expiry",
                      "Probation Completion",
                    ].map(scenario => (
                      <Button
                        key={scenario}
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        disabled={!isTestMode}
                        onClick={() => handleSimulate(scenario)}
                      >
                        <Clock className="w-4 h-4 mr-2 text-indigo-500" /> {scenario}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test Mode Audit Log</CardTitle>
                <CardDescription>Record of all date override actions.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Changed By</TableHead>
                      <TableHead>Old Date</TableHead>
                      <TableHead>New Date</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testMode ? (
                      <TableRow>
                        <TableCell>{testMode.changedByName}</TableCell>
                        <TableCell>{testMode.oldDate ? new Date(testMode.oldDate).toLocaleDateString() : '—'}</TableCell>
                        <TableCell>{testMode.newDate ? new Date(testMode.newDate).toLocaleDateString() : '—'}</TableCell>
                        <TableCell className="text-sm text-slate-500">{new Date(testMode.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-slate-400 py-8">No test mode sessions yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Ledger Settings Tab ── */}
        <TabsContent value="ledgersettings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" /> Leave Ledger Visibility
                </CardTitle>
                <CardDescription>
                  Control what employees can see in their Leave Ledger. HR/Admin always sees full details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* CL Balance toggle */}
                <div className="flex items-start justify-between gap-4 p-4 border rounded-lg bg-slate-50">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center ${
                      clBalanceVisible ? 'bg-green-100' : 'bg-slate-200'
                    }`}>
                      {clBalanceVisible
                        ? <Eye className="w-5 h-5 text-green-600" />
                        : <EyeOff className="w-5 h-5 text-slate-500" />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Show CL Running Balance to Employee</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        When <strong>ON</strong>: employees see their CL balance column in the Leave Ledger.<br />
                        When <strong>OFF</strong>: the CL balance is hidden (shown as <em>Hidden</em>).<br />
                        CL leave taken is always visible regardless of this setting.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={clBalanceVisible ? 'default' : 'outline'}
                    size="sm"
                    className="shrink-0 min-w-[80px]"
                    onClick={() => setClBalanceVisible(!clBalanceVisible)}
                  >
                    {clBalanceVisible ? 'ON' : 'OFF'}
                  </Button>
                </div>

                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  clBalanceVisible
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}>
                  {clBalanceVisible
                    ? <Eye className="w-4 h-4 shrink-0" />
                    : <EyeOff className="w-4 h-4 shrink-0" />}
                  <span>
                    {clBalanceVisible
                      ? 'Employees will see their CL running balance in the Leave Ledger.'
                      : 'CL running balance is hidden from employees. Only HR/Admin can see it.'}
                  </span>
                </div>

                <Button
                  className="w-full"
                  onClick={handleSaveClSetting}
                  disabled={savingClSetting}
                >
                  {savingClSetting ? 'Saving...' : 'Save Ledger Settings'}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-50 border-dashed">
              <CardHeader>
                <CardTitle className="text-sm text-slate-600">Why hide CL balance?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <p>
                  Some organisations prefer not to show the CL running balance to employees to
                  avoid confusion around accrual timing or to maintain HR discretion.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-500">
                  <li>Employees always see <strong>how many CL days were taken</strong></li>
                  <li>The debit column remains visible (days deducted per leave)</li>
                  <li>Only the <strong>running balance column</strong> is hidden when OFF</li>
                  <li>HR/Admin always sees the full ledger regardless of this setting</li>
                </ul>
              </CardContent>
            </Card>

            {/* Accrual Engine Trigger */}
            <Card className="lg:col-span-2 border-indigo-100 bg-indigo-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-700">
                  <Calculator className="w-5 h-5" /> PL Accrual Engine (Rule 51)
                </CardTitle>
                <CardDescription>
                  Manually trigger the monthly PL accrual based on days worked (1.5 days/month pro-rata).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2">
                    <Label>Target Month</Label>
                    <Select value={accrualMonth} onValueChange={v => v && setAccrualMonth(v)}>
                      <SelectTrigger className="w-40 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Year</Label>
                    <Select value={accrualYear} onValueChange={v => v && setAccrualYear(v)}>
                      <SelectTrigger className="w-32 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2026">2026</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="bg-indigo-600 hover:bg-indigo-700" 
                    onClick={handleRunAccrual}
                    disabled={runningAccrual}
                  >
                    {runningAccrual ? 'Processing...' : 'Run Accrual for Selection'}
                  </Button>
                </div>
                <div className="mt-4 p-3 bg-white/50 border border-indigo-100 rounded text-xs text-indigo-800">
                  <strong>Note:</strong> This will calculate (Worked Days / Total Days) * 1.5 for all active employees. 
                  It will create a "MONTHLY_ACCRUAL" adjustment entry and update their live PL balances.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
