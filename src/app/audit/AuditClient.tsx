"use client"

import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { History, Search, Download } from "lucide-react"
import { EmployeeStatusBadge } from "@/components/EmployeeStatusBadge"

export function AuditClient({ logs }: { logs: any[] }) {
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "createdAt",
      header: "Timestamp",
      cell: ({ row }) => (
        <div className="text-xs text-slate-500 font-mono">
          {new Date(row.original.createdAt).toLocaleString()}
        </div>
      ),
    },
    {
      accessorKey: "userName",
      header: "User",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{row.original.userName}</span>
            <EmployeeStatusBadge status={row.original.userStatus} />
          </div>
          <span className="text-[10px] uppercase text-slate-400 font-bold">{row.original.userRole}</span>
        </div>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => {
        const action = row.original.action
        let color = "bg-slate-100 text-slate-700"
        if (action.includes("APPROVED")) color = "bg-green-100 text-green-700"
        if (action.includes("REJECTED") || action.includes("RESET")) color = "bg-red-100 text-red-700"
        if (action.includes("ADJUSTMENT")) color = "bg-amber-100 text-amber-700"
        if (action.includes("APPLIED")) color = "bg-indigo-100 text-indigo-700"
        
        return <Badge className={`${color} border-none`}>{action.replace(/_/g, " ")}</Badge>
      },
    },
    {
      accessorKey: "entity",
      header: "Entity",
      cell: ({ row }) => <span className="text-xs text-slate-500">{row.original.entity}</span>,
    },
    {
      accessorKey: "entityId",
      header: "Entity ID",
      cell: ({ row }) => <span className="text-xs font-mono text-slate-500">{row.original.entityId || "—"}</span>,
    },
    {
      accessorKey: "oldValue",
      header: "Old Value",
      cell: ({ row }) => <span className="text-xs font-mono text-slate-600">{row.original.oldValue || "—"}</span>,
    },
    {
      accessorKey: "newValue",
      header: "New Value",
      cell: ({ row }) => <span className="text-xs font-mono text-slate-600">{row.original.newValue || "—"}</span>,
    },
    {
      accessorKey: "metadata",
      header: "Details",
      cell: ({ row }) => {
        const meta = row.original.metadata
        if (!meta) return <span className="text-slate-300">—</span>
        return (
          <div className="max-w-xs truncate text-xs text-slate-600" title={JSON.stringify(meta, null, 2)}>
            {Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join(", ")}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: logs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const handleExportCSV = () => {
    const headers = "Timestamp,User,Action,Entity,Entity ID,Old Value,New Value,Metadata\n"
    const rows = logs.map(l => 
      `"${l.createdAt}","${l.userName}","${l.action}","${l.entity}","${l.entityId || ""}","${l.oldValue || ""}","${l.newValue || ""}","${JSON.stringify(l.metadata).replace(/"/g, '""')}"`
    ).join("\n")
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = window.window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_logs_${new Date().toISOString()}.csv`
    a.click()
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2 max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400" />
            <Input
              placeholder="Filter by action or user..."
              className="h-9"
              onChange={(e) => table.setGlobalFilter(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
        <Table>
          <TableHeader className="bg-slate-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No logs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-end space-x-2 p-4 border-t">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
