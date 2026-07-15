"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { importEmployees, CsvEmployeeRow } from "./actions"
import { toast } from "sonner"
import { AddEmployeeDialog } from "./AddEmployeeDialog"
import { FileDown, RefreshCw, Loader2, Upload } from "lucide-react"
import { useRouter } from "next/navigation"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  currentUserRole?: string
}

export function TeamDataTable<TData, TValue>({
  columns,
  data,
  currentUserRole,
}: DataTableProps<TData, TValue>) {
  const isAdmin = currentUserRole === 'ADMIN'
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [isImporting, setIsImporting] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleRefresh = () => {
    router.refresh()
  }

  const handleDownloadTemplate = () => {
    const headers = "name,email,role,departmentName,joinDate(YYYY-MM-DD)\n"
    const sample = "Alice Smith,alice@example.com,EMPLOYEE,Engineering,2024-01-01\n"
    const blob = new Blob([headers + sample], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'employee_import_template.csv'
    a.click()
  }

  const handleExportCsv = () => {
    const headers = "Name,Email,Role,Department,PL Balance,CL/SL Balance,Join Date,LWD\n"
    const rows = table.getFilteredRowModel().rows.map(row => {
      const d = row.original as any
      return `"${d.name}","${d.email}","${d.role}","${d.department}","${d.plBalance}","${d.clSlBalance}","${d.joinDate}","${d.lastWorkingDay || ""}"`
    }).join("\n")
    
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team_directory_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    toast.success("Directory exported successfully")
  }

  const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) {
        toast.error("CSV must contain a header row and at least one data row.")
        return
      }

      // Very simple CSV parser (assuming no commas inside quotes)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const expectedHeaders = ['name', 'email', 'role', 'departmentname', 'joindate']
      
      const rows: CsvEmployeeRow[] = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim())
        const rowData: any = {}
        headers.forEach((header, index) => {
          if (expectedHeaders.includes(header)) {
            // Re-map to correct casing for CsvEmployeeRow
            const key = header === 'departmentname' ? 'departmentName' : header === 'joindate' ? 'joinDate' : header;
            rowData[key] = values[index]
          }
        })
        return rowData as CsvEmployeeRow
      })

      const result = await importEmployees(rows)
      if (result.success) {
        toast.success(`Successfully imported ${result.count} employees.`)
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to parse or import CSV.")
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    meta: {
      currentUserRole,
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between p-4 gap-4">
        <Input
          placeholder="Search by name..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImportCsv}
            disabled={isImporting}
          />
          {isAdmin && (
            <Button variant="outline" onClick={handleDownloadTemplate} size="sm">
              <FileDown className="w-4 h-4 mr-2" /> Template
            </Button>
          )}
          <Button variant="outline" onClick={handleExportCsv} size="sm">
            <FileDown className="w-4 h-4 mr-2 text-indigo-600" /> Export CSV
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} size="sm" disabled={isImporting}>
              {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Import CSV
            </Button>
          )}
          {isAdmin && <AddEmployeeDialog onRefresh={handleRefresh} />}
        </div>
      </div>
      <div className="rounded-md border-t">
        <Table>
          <TableHeader className="bg-slate-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 p-4 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
