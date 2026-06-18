"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, FileText, AlertTriangle } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { toast } from "sonner"
import { EmployeeStatusBadge } from "@/components/EmployeeStatusBadge"

export function ReportsClient({ data }: { data: any[] }) {

  const handleExportCSV = () => {
    const headers = [
      "Employee", "Department",
      "Opening PL", "PL Accrued", "PL Used", "Carry Fwd", "PL Balance",
      "CL Balance", "SL Balance", "COMP Balance"
    ]
    const csvContent = [
      headers.join(","),
      ...data.map(row =>
        `"${row.name}","${row.department}",${row.openingPl},${row.plAccrued},${row.plUsed},${row.plCarryForward},${row.pl},${row.cl},${row.sl},${row.comp}`
      )
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.setAttribute("href", URL.createObjectURL(blob))
    link.setAttribute("download", `leave_report_${new Date().getFullYear()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("CSV Exported Successfully")
  }

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    const year = new Date().getFullYear()

    // Header
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text("Leave Balance Report", 14, 16)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Year: ${year}   |   Generated: ${new Date().toLocaleDateString('en-IN')}   |   Confidential`, 14, 23)

    // Section 1: PL Ledger
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text("1. Privilege Leave (PL) Ledger", 14, 33)
    autoTable(doc, {
      startY: 37,
      head: [["Employee", "Dept", "Opening", "Accrued (YTD)", "Used", "Carry Fwd", "Net Balance"]],
      body: data.map(row => [
        row.name, row.department,
        row.openingPl, row.plAccrued, row.plUsed,
        row.plCarryForward, row.pl
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [248, 249, 250] },
    })

    // Section 2: CL/SL Ledger
    const afterPl = (doc as any).lastAutoTable?.finalY + 10 || 120
    doc.setFont('helvetica', 'bold')
    doc.text("2. Casual & Sick Leave (CL/SL) Ledger", 14, afterPl)
    autoTable(doc, {
      startY: afterPl + 4,
      head: [["Employee", "Dept", "CL Balance", "SL Balance", "CL Used", "SL Used"]],
      body: data.map(row => [row.name, row.department, row.cl, row.sl, row.clUsed, row.slUsed]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [245, 158, 11] },
      alternateRowStyles: { fillColor: [248, 249, 250] },
    })

    // Section 3: Negative Leave Summary (Rule 46)
    const afterCl = (doc as any).lastAutoTable?.finalY + 10 || 200
    const negativeRows = data.filter(r => r.negativeTracking.length > 0 || r.pl < 0 || r.cl < 0 || r.sl < 0)
    if (negativeRows.length > 0) {
      doc.addPage()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text("3. Negative Leave Summary (Rule 46)", 14, 20)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text("Employees below have negative leave balances or recorded recoveries required.", 14, 27)
      autoTable(doc, {
        startY: 32,
        head: [["Employee", "Type", "Days", "Daily Rate", "Recovery Amount", "Status"]],
        body: negativeRows.flatMap(row => {
          if (row.negativeTracking.length > 0) {
            return row.negativeTracking.map((nt: any) => [
              row.name, nt.leaveType, nt.negativeDays, `₹${nt.dailySalary}`, `₹${nt.recoveryAmount}`, nt.status
            ])
          }
          const negDays = Math.min(row.pl, row.cl, row.sl)
          const recovery = Math.abs(negDays) * 2000
          return [[row.name, negDays === row.pl ? 'PL' : 'CL/SL', negDays, '₹2,000', `₹${recovery}`, 'PENDING']]
        }),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [220, 38, 38] },
      })
    }

    // Section 4: COMP Ledger
    doc.addPage()
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text("4. Compensatory Off (COMP) History", 14, 20)
    autoTable(doc, {
      startY: 26,
      head: [["Employee", "Dept", "COMP Balance"]],
      body: data.map(row => [row.name, row.department, row.comp]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
    })

    doc.save(`leave_report_${year}.pdf`)
    toast.success("PDF Report Generated Successfully")
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
        <div>
          <CardTitle>Tabbed Ledger</CardTitle>
          <CardDescription>Full leave ledger per Rule 46 — opening, accrued, used, carry-forward, and negative leave sections</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={handleExportPDF}>
            <FileText className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs defaultValue="pl">
          <TabsList className="mb-4">
            <TabsTrigger value="pl">Privilege Leave (PL)</TabsTrigger>
            <TabsTrigger value="clsl">Casual & Sick (CL/SL)</TabsTrigger>
            <TabsTrigger value="comp">Compensatory (COMP)</TabsTrigger>
            <TabsTrigger value="negative">
              <AlertTriangle className="w-3 h-3 mr-1 text-red-500" /> Negative Leave
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pl">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Opening PL</TableHead>
                    <TableHead className="text-right">Accrued (YTD)</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead className="text-right">Carry Fwd</TableHead>
                    <TableHead className="text-right font-bold">Net Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(row => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{row.name}</span>
                          <EmployeeStatusBadge status={row.status} />
                        </div>
                      </TableCell>
                      <TableCell>{row.department}</TableCell>
                      <TableCell className="text-right">{row.openingPl}</TableCell>
                      <TableCell className="text-right text-indigo-600">{row.plAccrued}</TableCell>
                      <TableCell className="text-right text-slate-500">−{row.plUsed}</TableCell>
                      <TableCell className="text-right text-amber-600">{row.plCarryForward}</TableCell>
                      <TableCell className={`text-right font-bold ${row.pl < 0 ? 'text-red-600' : 'text-green-600'}`}>{row.pl}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="clsl">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">CL Balance</TableHead>
                    <TableHead className="text-right">CL Used</TableHead>
                    <TableHead className="text-right">SL Balance</TableHead>
                    <TableHead className="text-right">SL Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(row => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{row.name}</span>
                          <EmployeeStatusBadge status={row.status} />
                        </div>
                      </TableCell>
                      <TableCell>{row.department}</TableCell>
                      <TableCell className="text-right font-semibold text-amber-600">{row.cl}</TableCell>
                      <TableCell className="text-right text-slate-500">−{row.clUsed}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">{row.sl}</TableCell>
                      <TableCell className="text-right text-slate-500">−{row.slUsed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="comp">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">COMP Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(row => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{row.name}</span>
                          <EmployeeStatusBadge status={row.status} />
                        </div>
                      </TableCell>
                      <TableCell>{row.department}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">{row.comp}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="negative">
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Employees with negative balances are flagged for recovery upon resignation per Rule 45.
              Final settlement deducts: <strong>Negative Days × Daily Salary</strong>.
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-red-50">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">PL Balance</TableHead>
                    <TableHead className="text-right">CL Balance</TableHead>
                    <TableHead className="text-right">SL Balance</TableHead>
                    <TableHead>Recovery Required</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.filter(r => r.negativeTracking.length > 0 || r.pl < 0 || r.cl < 0 || r.sl < 0).length > 0
                    ? data.filter(r => r.negativeTracking.length > 0 || r.pl < 0 || r.cl < 0 || r.sl < 0).map(row => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{row.name}</span>
                            <EmployeeStatusBadge status={row.status} />
                          </div>
                          {row.negativeTracking.length > 0 && (
                            <div className="text-[10px] text-red-500 font-normal">
                              {row.negativeTracking.length} recorded recovery entries
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{row.department}</TableCell>
                        <TableCell className={`text-right font-bold ${row.pl < 0 ? 'text-red-600' : ''}`}>{row.pl}</TableCell>
                        <TableCell className={`text-right font-bold ${row.cl < 0 ? 'text-red-600' : ''}`}>{row.cl}</TableCell>
                        <TableCell className={`text-right font-bold ${row.sl < 0 ? 'text-red-600' : ''}`}>{row.sl}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {row.negativeTracking.some((nt: any) => nt.status === 'PENDING') ? 'Recovery Pending' : 'Flagged'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                    : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                          <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-40" />
                          No employees with negative leave balances.
                        </TableCell>
                      </TableRow>
                    )
                  }
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
