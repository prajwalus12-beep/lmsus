"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { MoreHorizontal, ArrowUpDown, Check, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { approveRequest, rejectRequest, approveCompOff, rejectCompOff } from "./actions"

export type LeaveRequestRow = {
  id: string
  employeeName: string
  department: string
  type: string
  startDate: string
  endDate: string
  reason: string
  status: string
  attachmentUrl?: string | null
}

export const columns: ColumnDef<LeaveRequestRow>[] = [
  {
    accessorKey: "employeeName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Employee
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: "department",
    header: "Department",
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <Badge variant="outline">{row.getValue("type")}</Badge>
  },
  {
    accessorKey: "startDate",
    header: "Start Date",
  },
  {
    accessorKey: "endDate",
    header: "End Date",
  },
  {
    accessorKey: "attachmentUrl",
    header: "Docs",
    cell: ({ row }) => {
      const url = row.getValue("attachmentUrl") as string
      if (!url) return <span className="text-slate-300">—</span>
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium text-xs"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View
        </a>
      )
    }
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge variant={
          status === 'HR_APPROVED' ? 'default' : 
          status === 'PENDING' ? 'secondary' : 'destructive'
        }>
          {status}
        </Badge>
      )
    }
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const req = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", className: "h-8 w-8 p-0" })}>
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(req.id)}>
              Copy request ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={async () => {
                try {
                  await approveRequest(req.id)
                  toast.success("Request approved")
                } catch (e) {
                  toast.error("Failed to approve")
                }
              }} 
              className="text-green-600"
            >
              <Check className="mr-2 h-4 w-4" /> Approve
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={async () => {
                try {
                  await rejectRequest(req.id)
                  toast.success("Request rejected")
                } catch (e) {
                  toast.error("Failed to reject")
                }
              }} 
              className="text-red-600"
            >
              <X className="mr-2 h-4 w-4" /> Reject
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export const compOffColumns: ColumnDef<any>[] = [
  {
    accessorKey: "employeeName",
    header: "Employee",
  },
  {
    accessorKey: "dateWorked",
    header: "Date Worked",
  },
  {
    accessorKey: "hoursWorked",
    header: "Hours",
  },
  {
    accessorKey: "daysCredited",
    header: "Credit (Days)",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge variant={
          status === 'APPROVED' ? 'default' : 
          status === 'PENDING' ? 'secondary' : 'destructive'
        }>
          {status}
        </Badge>
      )
    }
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const co = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", className: "h-8 w-8 p-0" })}>
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem 
              onClick={async () => {
                try {
                  await approveCompOff(co.id)
                  toast.success("Comp-off approved")
                } catch (e) {
                  toast.error("Failed to approve")
                }
              }} 
              className="text-green-600"
            >
              <Check className="mr-2 h-4 w-4" /> Approve
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={async () => {
                try {
                  await rejectCompOff(co.id)
                  toast.success("Comp-off rejected")
                } catch (e) {
                  toast.error("Failed to reject")
                }
              }} 
              className="text-red-600"
            >
              <X className="mr-2 h-4 w-4" /> Reject
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
