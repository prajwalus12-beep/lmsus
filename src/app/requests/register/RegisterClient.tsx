"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { LocalDateDisplay } from "@/components/LocalDateDisplay"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type RequestData = {
  id: string
  employeeName: string
  department: string
  type: string
  startDate: string
  endDate: string
  duration: number
  appliedAt: string
  status: string
  approvedAt: string | null
  approvedByName: string
}

export function RegisterClient({
  initialRequests,
  departments = [],
  isAdmin,
}: {
  initialRequests: RequestData[]
  departments?: string[]
  isAdmin: boolean
}) {
  const [selectedDept, setSelectedDept] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredRequests = initialRequests.filter(req => {
    const matchesDept = selectedDept === "ALL" || req.department === selectedDept
    const matchesSearch = req.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesDept && matchesSearch
  })

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex items-center gap-2 max-w-md">
          <Input
            placeholder="Search employee name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={selectedDept}
            onValueChange={setSelectedDept}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Departments</SelectItem>
              {departments?.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
              {filteredRequests.map((row) => (
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
                    <LocalDateDisplay date={new Date(row.startDate)} includeTime={false} /> - <LocalDateDisplay date={new Date(row.endDate)} includeTime={false} />
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    <LocalDateDisplay date={new Date(row.appliedAt)} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'HR_APPROVED' ? 'default' : (row.status === 'REJECTED' ? 'destructive' : 'secondary')}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {row.approvedAt ? <LocalDateDisplay date={new Date(row.approvedAt)} /> : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{row.approvedByName}</TableCell>
                </TableRow>
              ))}
              {filteredRequests.length === 0 && (
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
