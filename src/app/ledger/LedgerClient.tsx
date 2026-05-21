"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  BookOpen, User, TrendingDown, TrendingUp, EyeOff, Loader2, Download, FileText, CheckCircle2, Info, Save
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { toast } from "sonner"

type LedgerEntry = {
  id: string
  date: string
  type: string
  description: string
  days: number | null
  startDate: string | null
  endDate: string | null
  clDebit: number | null
  plDebit: number | null
  clCredit: number | null
  plCredit: number | null
  clBalance: number
  plBalance: number
  status: string | null
  isOpening: boolean
  isAdjustment: boolean
  isClosing: boolean
}

type UserInfo = {
  id: string
  name: string
  department: string
  openingCl: number
  openingPl: number
}

type AllUser = {
  id: string
  name: string
  department: { name: string } | null
}

interface Props {
  initialEntries: LedgerEntry[]
  initialUser: UserInfo
  currentCl: number
  currentPl: number
  allUsers: AllUser[]
  role: string
  year: number
  showClBalance: boolean
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", { 
    day: "2-digit", 
    month: "short", 
    year: "numeric",
    timeZone: "Asia/Kolkata"
  })
}

function fmtDays(n: number | null): string {
  if (n === null) return "—"
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

function BalancePill({ val, hide }: { val: number; hide?: boolean }) {
  if (hide) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-medium">
        <EyeOff className="w-3 h-3" /> Hidden
      </span>
    )
  }
  const neg = val < 0
  return (
    <span className={`font-bold tabular-nums ${neg ? "text-red-600" : "text-slate-800"}`}>
      {fmtDays(val)}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  if (type === "OPENING")
    return <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-100">Opening</Badge>
  if (type === "CLOSING")
    return <Badge className="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100">Closing</Badge>
  if (type === "CL")
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">CL</Badge>
  if (type === "PL")
    return <Badge className="bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100">PL</Badge>
  if (type === "ACCRUAL")
    return <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-100">Accrual</Badge>
  if (type.startsWith("ADJ"))
    return <Badge className="bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-100">Adj</Badge>
  return <Badge variant="outline">{type}</Badge>
}

export function LedgerClient({
  initialEntries,
  initialUser,
  currentCl,
  currentPl,
  allUsers,
  role,
  year,
  showClBalance,
}: Props) {
  const isHR = role === "ADMIN"
  const [entries, setEntries] = useState<LedgerEntry[]>(initialEntries)
  const [selectedUser, setSelectedUser] = useState<UserInfo>(initialUser)
  const [loading, setLoading] = useState(false)
  const [selectedYear, setSelectedYear] = useState(year)

  const fetchLedger = useCallback(async (userId: string, yr: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leave/ledger?userId=${userId}&year=${yr}`)
      const data = await res.json()
      if (data.entries) {
        setEntries(data.entries)
        setSelectedUser(prev => ({
          ...prev,
          id: data.user?.id ?? userId,
          name: data.user?.name ?? prev.name,
          department: data.user?.department ?? prev.department,
          openingCl: data.balance?.openingCl ?? prev.openingCl,
          openingPl: data.balance?.openingPl ?? prev.openingPl,
        }))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleUserChange = (userId: string) => {
    fetchLedger(userId, selectedYear)
  }

  const handleYearChange = (yr: string) => {
    const newYear = parseInt(yr)
    setSelectedYear(newYear)
    fetchLedger(selectedUser.id, newYear)
  }

  // Summary stats
  const totalClTaken = entries.reduce((acc, e) => acc + (e.clDebit || 0), 0)
  const totalPlTaken = entries.reduce((acc, e) => acc + (e.plDebit || 0), 0)
  
  const closing = entries.find((e) => e.isClosing)

  const yearOptions = [year - 1, year, year + 1].filter((y) => y >= 2024)

  const handleExportCSV = () => {
    const headers = [
      "Date", "Description", "Type", "Days", 
      "CL Debit", "CL Balance", "PL Debit", "PL Balance"
    ]
    const rows = entries.map(e => [
      fmtDate(e.startDate ?? e.date),
      e.description,
      e.type,
      fmtDays(e.days),
      e.clDebit !== null ? fmtDays(e.clDebit) : (e.clCredit !== null ? `+${fmtDays(e.clCredit)}` : ""),
      (!showClBalance && !isHR) ? "Hidden" : fmtDays(e.clBalance),
      e.plDebit !== null ? fmtDays(e.plDebit) : (e.plCredit !== null ? `+${fmtDays(e.plCredit)}` : ""),
      fmtDays(e.plBalance)
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.setAttribute("href", URL.createObjectURL(blob))
    link.setAttribute("download", `leave_ledger_${selectedUser.name}_${selectedYear}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("CSV Exported Successfully")
  }

  const handleExportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`Leave Ledger: ${selectedUser.name}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`Year: ${selectedYear} | Department: ${selectedUser.department} | Generated: ${new Date().toLocaleDateString()}`, 14, 22)

    autoTable(doc, {
      startY: 30,
      head: [["Date", "Description", "Type", "Days", "CL Bal", "PL Bal"]],
      body: entries.map(e => [
        fmtDate(e.startDate ?? e.date),
        e.description,
        e.type,
        fmtDays(e.days),
        (!showClBalance && !isHR) ? "Hidden" : fmtDays(e.clBalance),
        fmtDays(e.plBalance)
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    })

    doc.save(`leave_ledger_${selectedUser.name}_${selectedYear}.pdf`)
    toast.success("PDF Exported Successfully")
  }

  return (
    <div className="space-y-5">
      {/* ── Controls bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {isHR && allUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              <Select value={selectedUser.id} onValueChange={(v) => v && handleUserChange(v)}>
                <SelectTrigger className="w-56 bg-white">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Select value={String(selectedYear)} onValueChange={(v) => v && handleYearChange(v)}>
            <SelectTrigger className="w-28 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Employee chip */}
        <div className="flex items-center gap-2 text-sm text-slate-600 bg-white border rounded-lg px-3 py-1.5 shadow-sm">
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-xs">
            {selectedUser.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold leading-none">{selectedUser.name}</p>
            <p className="text-xs text-slate-400">{selectedUser.department}</p>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-amber-600 mb-1">CL Opening</p>
            <p className="text-2xl font-bold text-amber-800">{fmtDays(selectedUser.openingCl)}</p>
            <p className="text-xs text-amber-500 mt-0.5">1 Jan {selectedYear}</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-orange-600">CL Taken</p>
              <TrendingDown className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-orange-800">{fmtDays(totalClTaken)}</p>
            <p className="text-[11px] text-orange-400 mt-1">days used (YTD)</p>
          </CardContent>
        </Card>

        <Card className="border-violet-200 bg-violet-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-violet-600">PL Taken</p>
              <TrendingDown className="w-4 h-4 text-violet-500" />
            </div>
            <p className="text-2xl font-bold text-violet-800">{fmtDays(totalPlTaken)}</p>
            <p className="text-[11px] text-violet-400 mt-1">days used (YTD)</p>
          </CardContent>
        </Card>

        <Card className="border-violet-200 bg-violet-50">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-violet-600 mb-1">PL Opening</p>
            <p className="text-2xl font-bold text-violet-800">{fmtDays(selectedUser.openingPl)}</p>
            <p className="text-xs text-violet-400 mt-0.5">1 Jan {selectedYear}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Ledger Table ── */}
      <Card className="shadow-sm">
        <CardHeader className="border-b pb-4 flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <div>
              <CardTitle className="text-base">
                Leave Ledger — {selectedUser.name} ({selectedYear})
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                All approved CL &amp; PL transactions with running balance
                {!showClBalance && !isHR && (
                  <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                    <EyeOff className="w-3 h-3" /> CL balance hidden by policy
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isHR && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  const res = await fetch("/api/admin/sync-ledger", { method: "POST" })
                  if (res.ok) {
                    toast.success("Ledger database updated successfully")
                    fetchLedger(selectedUser.id, selectedYear)
                  } else {
                    toast.error("Failed to update ledger database")
                  }
                }}
                className="text-amber-600 border-amber-200 hover:bg-amber-50"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" /> Update Database
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Export PDF
              </Button>
            </div>
            {loading && (
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b-2 border-slate-200">
                  <TableHead className="w-10 text-center text-slate-500 font-semibold">#</TableHead>
                  <TableHead className="text-slate-600 font-semibold">Date</TableHead>
                  <TableHead className="text-slate-600 font-semibold min-w-[220px]">Particulars</TableHead>
                  <TableHead className="text-center text-slate-600 font-semibold">Type</TableHead>
                  <TableHead className="text-right text-slate-600 font-semibold">Duration</TableHead>
                  {/* CL section */}
                  <TableHead className="text-right text-amber-700 font-semibold bg-amber-50 border-l border-amber-200">
                    Worked Days (Month)
                  </TableHead>
                  <TableHead className="text-right text-amber-700 font-semibold bg-amber-50">
                    CL Debit
                  </TableHead>
                  <TableHead className="text-right text-amber-700 font-semibold bg-amber-50 border-r border-amber-200">
                    CL Balance
                  </TableHead>
                  {/* PL section */}
                  <TableHead className="text-right text-violet-700 font-semibold bg-violet-50 border-l border-violet-200">
                    PL Debit
                  </TableHead>
                  <TableHead className="text-right text-violet-700 font-semibold bg-violet-50">
                    PL Balance
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {entries.map((entry, idx) => {
                  const isSpecial = entry.isOpening || entry.isClosing

                  if (entry.isOpening) {
                    return (
                      <TableRow
                        key={entry.id}
                        className="bg-indigo-50 border-b-2 border-indigo-200 font-semibold"
                      >
                        <TableCell className="text-center text-indigo-400 text-xs">—</TableCell>
                        <TableCell className="text-indigo-700 font-semibold whitespace-nowrap">
                          {fmtDate(entry.date)}
                        </TableCell>
                        <TableCell className="text-indigo-800 font-semibold">
                          {entry.description}
                        </TableCell>
                        <TableCell className="text-center">
                          <TypeBadge type={entry.type} />
                        </TableCell>
                        <TableCell className="text-right text-indigo-500">—</TableCell>
                        {/* CL opening */}
                        <TableCell className="text-right bg-amber-50 border-l border-amber-200 text-amber-600">
                          —
                        </TableCell>
                        <TableCell className="text-right bg-amber-50 border-r border-amber-200">
                          <BalancePill val={entry.clBalance} hide={!showClBalance} />
                        </TableCell>
                        {/* PL opening */}
                        <TableCell className="text-right bg-violet-50 border-l border-violet-200 text-violet-600">
                          —
                        </TableCell>
                        <TableCell className="text-right bg-violet-50">
                          <BalancePill val={entry.plBalance} />
                        </TableCell>
                      </TableRow>
                    )
                  }

                  if (entry.isClosing) {
                    return (
                      <TableRow
                        key={entry.id}
                        className="bg-slate-100 border-t-2 border-slate-300 font-bold"
                      >
                        <TableCell className="text-center text-slate-400 text-xs">—</TableCell>
                        <TableCell className="text-slate-700 font-bold whitespace-nowrap">
                          {fmtDate(entry.date)}
                        </TableCell>
                        <TableCell className="text-slate-800 font-bold">
                          {entry.description}
                        </TableCell>
                        <TableCell className="text-center">
                          <TypeBadge type={entry.type} />
                        </TableCell>
                        <TableCell className="text-right text-slate-400">—</TableCell>
                        <TableCell className="text-right bg-amber-50 border-l border-amber-200 text-slate-400">
                          —
                        </TableCell>
                        <TableCell className="text-right bg-amber-50 border-r border-amber-200">
                          <BalancePill val={entry.clBalance} hide={!showClBalance} />
                        </TableCell>
                        <TableCell className="text-right bg-violet-50 border-l border-violet-200 text-slate-400">
                          —
                        </TableCell>
                        <TableCell className="text-right bg-violet-50">
                          <BalancePill val={entry.plBalance} />
                        </TableCell>
                      </TableRow>
                    )
                  }

                  // Normal leave / adjustment row
                  const rowNum = entries
                    .slice(0, idx)
                    .filter((e) => !e.isOpening && !e.isClosing).length + 1

                  const isAdj = entry.isAdjustment
                  const isAccrual = entry.type === "ACCRUAL"
                  const rowClass = isAccrual
                    ? "bg-indigo-50/40 hover:bg-indigo-50"
                    : isAdj
                      ? "bg-teal-50/40 hover:bg-teal-50"
                      : "hover:bg-slate-50/80 transition-colors"

                  return (
                    <TableRow key={entry.id} className={`${rowClass} border-b border-slate-100`}>
                      <TableCell className="text-center text-xs text-slate-400 font-mono">
                        {rowNum}
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-sm text-slate-600">
                        {fmtDate(entry.startDate ?? entry.date)}
                        {entry.endDate && entry.startDate !== entry.endDate && (
                          <span className="block text-xs text-slate-400">
                            to {fmtDate(entry.endDate)}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="max-w-xs">
                        <p className="text-sm text-slate-800 font-medium truncate" title={entry.description}>
                          {entry.description}
                        </p>
                        {entry.status && !isAdj && (
                          <span className="text-xs text-slate-400">{entry.status.replace(/_/g, " ")}</span>
                        )}
                        {isAdj && !isAccrual && (
                          <span className="text-xs text-teal-600 font-medium">Manual Adjustment</span>
                        )}
                        {isAccrual && (
                          <span className="text-xs text-indigo-600 font-medium">Monthly PL Accrual</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <TypeBadge type={entry.type} />
                      </TableCell>

                      <TableCell className="text-right font-mono text-sm text-slate-700">
                        {fmtDays(entry.days)}
                      </TableCell>

                      {/* Working Days */}
                      <TableCell 
                        className="text-right bg-amber-50/60 border-l border-amber-100 font-mono text-xs text-slate-500"
                        title={isAccrual && entry.description.includes("(") ? entry.description.split("(")[1]?.split(")")[0] : "Working Days Breakdown"}
                      >
                        {(() => {
                          const istDateStr = new Date(entry.date).toLocaleString("en-US", { 
                            timeZone: "Asia/Kolkata", 
                            day: "numeric" 
                          })
                          const isFirstOfMonth = istDateStr === "1"
                          
                          if (entry.workingDays && (isFirstOfMonth || isAccrual || entry.isOpening)) {
                            return entry.workingDays
                          }
                          return "—"
                        })()}
                      </TableCell>

                      {/* CL debit */}
                      <TableCell className="text-right bg-amber-50/60">
                        {entry.clDebit !== null ? (
                          <span className="font-semibold text-orange-600 tabular-nums">
                            {fmtDays(entry.clDebit)}
                          </span>
                        ) : entry.clCredit !== null ? (
                          <span className="font-semibold text-green-600 tabular-nums">
                            +{fmtDays(entry.clCredit)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>

                      {/* CL balance */}
                      <TableCell className="text-right bg-amber-50/60 border-r border-amber-100">
                        {entry.clDebit !== null || entry.clCredit !== null ? (
                          <BalancePill val={entry.clBalance} hide={!showClBalance} />
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </TableCell>

                      {/* PL debit */}
                      <TableCell className="text-right bg-violet-50/60 border-l border-violet-100">
                        {entry.plDebit !== null ? (
                          <span className="font-semibold text-violet-600 tabular-nums">
                            {fmtDays(entry.plDebit)}
                          </span>
                        ) : entry.plCredit !== null ? (
                          <span className="font-semibold text-green-600 tabular-nums">
                            +{fmtDays(entry.plCredit)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>

                      {/* PL balance */}
                      <TableCell className="text-right bg-violet-50/60">
                        {entry.plDebit !== null || entry.plCredit !== null ? (
                          <BalancePill val={entry.plBalance} />
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}

                {entries.filter((e) => !e.isOpening && !e.isClosing).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-16 text-slate-400">
                      <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No CL or PL leaves taken in {selectedYear}</p>
                      <p className="text-xs mt-1">Only approved leaves appear here.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-indigo-200 inline-block" /> Opening / Closing row
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-200 inline-block" /> CL columns
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-violet-200 inline-block" /> PL columns
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-teal-100 border border-teal-300 inline-block" /> Manual adjustment
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-bold text-red-600">Red</span> = Negative balance
        </span>
      </div>
    </div>
  )
}
