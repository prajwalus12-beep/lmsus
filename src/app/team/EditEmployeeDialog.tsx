"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { updateEmployee } from "./actions"

export function EditEmployeeDialog({ user, open, onOpenChange }: { user: any, open: boolean, onOpenChange: (open: boolean) => void }) {
  const [role, setRole] = useState(user?.role || "EMPLOYEE")
  const [name, setName] = useState(user?.name || "")
  const [status, setStatus] = useState(user?.status || "ACTIVE")
  const [departmentId, setDepartmentId] = useState(user?.departmentId || "")
  const [departments, setDepartments] = useState<any[]>([])
  const [lwd, setLwd] = useState(user?.lastWorkingDay ? new Date(user.lastWorkingDay).toISOString().split('T')[0] : "")
  const [probationEndDate, setProbationEndDate] = useState(user?.probationEndDate || "")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetch("/api/settings?tab=departments")
        .then(res => res.json())
        .then(data => setDepartments(data.departments || []))
    }
  }, [open])

  useEffect(() => {
    if (user) {
      setName(user.name)
      setRole(user.role)
      setStatus(user.status || "ACTIVE")
      setDepartmentId(user.departmentId || "")
      setLwd(user.lastWorkingDay ? new Date(user.lastWorkingDay).toISOString().split('T')[0] : "")
      setProbationEndDate(user.probationEndDate || "")
    }
  }, [user])

  if (!user) return null

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await updateEmployee(user.id, {
        name,
        role,
        departmentId,
        status,
        lastWorkingDay: lwd || null,
        probationEndDate: probationEndDate || null,
      })
      if (res.success) {
        toast.success("Employee updated successfully")
        onOpenChange(false)
      } else {
        toast.error("Update failed")
      }
    } catch (e) {
      toast.error("Error updating employee")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Employee: {user.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select department">
                  {departments.find(d => d.id === departmentId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role">
                    {role === "ADMIN" ? "Admin" : 
                     role === "MANAGER" ? "Manager" : "Employee"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status">
                    {status === "ACTIVE" ? "Active" : 
                     status === "NOTICE_PERIOD" ? "Notice Period" : "Resigned"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="NOTICE_PERIOD">Notice Period</SelectItem>
                  <SelectItem value="RESIGNED">Resigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Probation End Date</Label>
            <Input type="date" value={probationEndDate} onChange={(e) => setProbationEndDate(e.target.value)} />
            <p className="text-[10px] text-slate-500">Set the date when the employee&apos;s probation period ends.</p>
          </div>
          <div className="space-y-2">
            <Label>Last Working Day (LWD)</Label>
            <Input type="date" value={lwd} onChange={(e) => setLwd(e.target.value)} />
            <p className="text-[10px] text-slate-500">Set only if the employee has resigned or is on notice.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
