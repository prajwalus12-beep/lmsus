"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Plus } from "lucide-react"

export function AddEmployeeDialog({ onRefresh }: { onRefresh: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState<any[]>([])

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "EMPLOYEE",
    departmentId: "",
    joinDate: new Date().toISOString().split("T")[0],
    openingPl: "0",
    openingCl: "0",
  })

  useEffect(() => {
    if (open) {
      fetch("/api/settings?tab=departments")
        .then(res => res.json())
        .then(data => setDepartments(data.departments || []))
    }
  }, [open])

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.departmentId) {
      toast.error("Please fill required fields")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        toast.success("Employee added successfully")
        setOpen(false)
        onRefresh()
        setFormData({
          name: "",
          email: "",
          password: "",
          role: "EMPLOYEE",
          departmentId: "",
          joinDate: new Date().toISOString().split("T")[0],
          openingPl: "0",
          openingCl: "0",
        })
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to add employee")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
        <Plus className="w-4 h-4 mr-2" /> Add Employee
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Create a new user account and initialize their leave balances.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Full Name*</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address*</Label>
              <Input 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                placeholder="you@company.com"
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input 
                value={formData.password} 
                onChange={e => setFormData({...formData, password: e.target.value})} 
                placeholder="Default: Unique@123"
                type="password"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={v => v && setFormData({...formData, role: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="ADMIN">Admin / HR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department*</Label>
              <Select value={formData.departmentId} onValueChange={v => v && setFormData({...formData, departmentId: v})}>
                <SelectTrigger><SelectValue placeholder="Select Dept" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Joining Date</Label>
              <Input 
                type="date" 
                value={formData.joinDate} 
                onChange={e => setFormData({...formData, joinDate: e.target.value})} 
              />
            </div>
            <div className="space-y-2 border-t pt-4 mt-2 col-span-2 text-sm font-semibold text-slate-700">
              Opening Balances (Jan 1st)
            </div>
            <div className="space-y-2">
              <Label>Opening PL</Label>
              <Input 
                type="number" 
                step="0.5"
                value={formData.openingPl} 
                onChange={e => setFormData({...formData, openingPl: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Opening CL</Label>
              <Input 
                type="number" 
                step="0.5"
                value={formData.openingCl} 
                onChange={e => setFormData({...formData, openingCl: e.target.value})} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? "Creating..." : "Save Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
