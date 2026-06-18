import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function EmployeeStatusBadge({ status, className }: { status: string; className?: string }) {
  if (!status) return null

  const normalizedStatus = status.toUpperCase()

  if (normalizedStatus === 'ACTIVE') {
    return (
      <Badge 
        variant="outline" 
        className={cn("bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] h-5 px-1.5 font-medium", className)}
      >
        Active
      </Badge>
    )
  }

  if (normalizedStatus === 'NOTICE_PERIOD' || normalizedStatus === 'ON NOTICE' || normalizedStatus === 'NOTICE PERIOD') {
    return (
      <Badge 
        variant="outline" 
        className={cn("bg-amber-50 text-amber-700 border-amber-200 text-[10px] h-5 px-1.5 font-medium", className)}
      >
        On Notice
      </Badge>
    )
  }

  if (normalizedStatus === 'RESIGNED' || normalizedStatus === 'INACTIVE') {
    return (
      <Badge 
        variant="outline" 
        className={cn("bg-red-50 text-red-700 border-red-200 text-[10px] h-5 px-1.5 font-medium", className)}
      >
        Resigned
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", className)}>
      {status}
    </Badge>
  )
}
