"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, Calculator, Trash2, Edit } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"
import { EditEmployeeDialog } from "./EditEmployeeDialog"
import { EmployeeStatusBadge } from "@/components/EmployeeStatusBadge"
import { deleteEmployee } from "./actions"
import { useRouter } from "next/navigation"
import { ProrateLeavesDialog } from "./ProrateLeavesDialog"

export type TeamRow = {
  id: string
  name: string
  email: string
  role: string
  status: string
  department: string
  plBalance: number
  clSlBalance: number
  joinDate: string
  lastWorkingDay?: string | null
  probationEndDate?: string | null
}

const ActionCell = ({ row, table }: { row: any; table: any }) => {
  const user = row.original
  const [editOpen, setEditOpen] = useState(false)
  const [prorateOpen, setProrateOpen] = useState(false)
  const router = useRouter()

  const meta = table?.options?.meta as any
  const isAdmin = meta?.currentUserRole === 'ADMIN'

  if (!isAdmin) {
    return <span className="text-slate-400 text-xs">—</span>
  }

  return (
    <div className="flex items-center gap-1">
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-slate-400 hover:text-indigo-600"
        onClick={() => setEditOpen(true)}
        title="Edit Employee"
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-slate-400 hover:text-amber-600"
        onClick={() => setProrateOpen(true)}
        title="Prorate Leaves"
      >
        <Calculator className="h-4 w-4" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-slate-400 hover:text-red-600"
        onClick={async () => {
           if(confirm(`Are you sure you want to delete ${user.name}?`)) {
             const promise = deleteEmployee(user.id).then(res => {
               if (res && 'success' in res && !res.success) {
                 throw new Error(res.error || 'Failed to delete');
               }
               return res;
             });
             toast.promise(promise, {
               loading: 'Deleting employee...',
               success: () => 'Employee deleted successfully',
               error: (err: any) => `Error: ${err.message || 'Failed to delete'}`
             });
           }
        }}
        title="Delete Employee"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      
      <EditEmployeeDialog 
        user={user} 
        open={editOpen} 
        onOpenChange={setEditOpen} 
      />

      <ProrateLeavesDialog
        user={user}
        open={prorateOpen}
        onOpenChange={setProrateOpen}
        onRefresh={() => router.refresh()}
      />
    </div>
  )
}

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "—"
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).replace(/ /g, "-")
}

export const columns: ColumnDef<TeamRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4 h-8 text-xs font-bold"
      >
        Name
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="min-w-[140px]">
        <div className="font-medium text-sm">{row.getValue("name")}</div>
        <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{row.original.email}</div>
      </div>
    )
  },
  {
    accessorKey: "department",
    header: () => <span className="text-xs font-bold">Dept</span>,
    cell: ({ row }) => <span className="text-xs">{row.getValue("department")}</span>
  },
  {
    accessorKey: "role",
    header: () => <span className="text-xs font-bold">Status</span>,
    cell: ({ row }) => {
      const role = row.getValue("role") as string
      const status = row.original.status as string
      const probationEndDateStr = row.original.probationEndDate
      
      let isProbation = false
      if (probationEndDateStr) {
        isProbation = new Date(probationEndDateStr) > new Date()
      } else {
        const joinDate = new Date(row.original.joinDate)
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
        isProbation = joinDate > sixMonthsAgo
      }

      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-[10px] px-1 h-4 uppercase">{role}</Badge>
            <EmployeeStatusBadge status={status} className="h-4" />
          </div>
          {isProbation && <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 text-[9px] px-1 h-4 w-fit">Probation</Badge>}
        </div>
      )
    }
  },
  {
    id: "balanceGroup",
    header: () => <div className="text-center text-[10px] font-black uppercase tracking-tighter text-indigo-600 border-b pb-1 mb-1">Balance</div>,
    columns: [
      {
        accessorKey: "plBalance",
        header: () => <span className="text-xs font-bold">PL</span>,
        cell: ({ row }) => {
          const bal = row.getValue("plBalance") as number
          const formatted = Number.isInteger(bal) ? bal : parseFloat(bal.toFixed(2))
          return <span className={`text-xs ${bal < 5 ? "text-red-600 font-bold" : ""}`}>{formatted}</span>
        }
      },
      {
        accessorKey: "clSlBalance",
        header: () => <span className="text-xs font-bold">CL/SL</span>,
        cell: ({ row }) => {
          const bal = row.getValue("clSlBalance") as number
          const formatted = Number.isInteger(bal) ? bal : parseFloat(bal.toFixed(2))
          return <span className="text-xs">{formatted}</span>
        }
      },
    ]
  },
  {
    accessorKey: "joinDate",
    header: () => <span className="text-xs font-bold">Joined</span>,
    cell: ({ row }) => <span className="text-xs">{formatDate(row.original.joinDate)}</span>
  },
  {
    accessorKey: "probationEndDate",
    header: () => <span className="text-xs font-bold">Probation End</span>,
    cell: ({ row }) => <span className="text-xs text-amber-600 font-medium">{formatDate(row.original.probationEndDate)}</span>
  },
  {
    accessorKey: "lastWorkingDay",
    header: () => <span className="text-xs font-bold">LWD</span>,
    cell: ({ row }) => <span className="text-xs text-red-500 font-medium">{formatDate(row.original.lastWorkingDay)}</span>
  },
  {
    id: "actions",
    header: () => <span className="text-xs font-bold">Actions</span>,
    cell: ({ row, table }) => <ActionCell row={row} table={table} />,
  },
]
