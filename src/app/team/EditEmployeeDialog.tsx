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
  const [lwd, setLwd] = useState(user?.lastWorkingDay ? new Date(user.lastWorkingDay).toISOString().split('T')[0] : "")
  const [loading, setLoading] = useState(false)

  // Use an effect to reset state when the user changes
  useEffect(() => {
    if (user) {
      setName(user.name)
      setRole(user.role)
      setLwd(user.lastWorkingDay ? new Date(user.lastWorkingDay).toISOString().split('T')[0] : "")
    }
  }, [user])

  if (!user) return null

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await updateEmployee(user.id, { name, role, lastWorkingDay: lwd })
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Employee: {user.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
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
