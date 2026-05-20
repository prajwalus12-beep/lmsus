"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, Calculator, Trash2, Edit, Eye } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"
import { EditEmployeeDialog } from "./EditEmployeeDialog"

export type TeamRow = {
  id: string
  name: string
  email: string
  role: string
  department: string
  plBalance: number
  clSlBalance: number
  joinDate: string
  lastWorkingDay?: string | null
}

const ActionCell = ({ row }: { row: any }) => {
  const user = row.original
  const [editOpen, setEditOpen] = useState(false)

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
        onClick={() => toast.info("Opening proration calculator for " + user.name)}
        title="Prorate Leaves"
      >
        <Calculator className="h-4 w-4" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-slate-400 hover:text-red-600"
        onClick={() => {
           if(confirm(`Are you sure you want to delete ${user.name}?`)) {
             toast.error("Employee deleted")
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
    </div>
  )
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
      const joinDate = new Date(row.original.joinDate)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      const isProbation = joinDate > sixMonthsAgo

      return (
        <div className="flex flex-col gap-1">
          <Badge variant="secondary" className="text-[10px] px-1 h-4">{role}</Badge>
          {isProbation && <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 text-[9px] px-1 h-4">Probation</Badge>}
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
          return <span className={`text-xs ${bal < 5 ? "text-red-600 font-bold" : ""}`}>{bal}</span>
        }
      },
      {
        accessorKey: "clSlBalance",
        header: () => <span className="text-xs font-bold">CL/SL</span>,
        cell: ({ row }) => <span className="text-xs">{row.getValue("clSlBalance")}</span>
      },
    ]
  },
  {
    accessorKey: "joinDate",
    header: () => <span className="text-xs font-bold">Joined</span>,
    cell: ({ row }) => <span className="text-xs">{row.getValue("joinDate")}</span>
  },
  {
    accessorKey: "lastWorkingDay",
    header: () => <span className="text-xs font-bold">LWD</span>,
    cell: ({ row }) => <span className="text-xs text-red-500 font-medium">{row.getValue("lastWorkingDay") || "—"}</span>
  },
  {
    id: "actions",
    header: () => <span className="text-xs font-bold">Actions</span>,
    cell: ({ row }) => <ActionCell row={row} />,
  },
]
