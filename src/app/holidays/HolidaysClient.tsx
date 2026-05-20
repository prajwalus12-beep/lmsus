"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit2, Trash2, Calendar, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"

type Holiday = {
  id: string
  name: string
  date: string
}

export function HolidaysClient() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Holiday | null>(null)
  const [name, setName] = useState("")
  const [date, setDate] = useState("")
  const [saving, setSaving] = useState(false)
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"

  useEffect(() => {
    fetchHolidays()
  }, [])

  const fetchHolidays = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/holidays")
      const data = await res.json()
      setHolidays(data)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAdd = () => {
    setEditing(null)
    setName("")
    setDate("")
    setOpen(true)
  }

  const handleOpenEdit = (h: Holiday) => {
    setEditing(h)
    setName(h.name)
    setDate(new Date(h.date).toISOString().split("T")[0])
    setOpen(true)
  }

  const handleSave = async () => {
    if (!name || !date) {
      toast.error("Please fill all fields")
      return
    }
    setSaving(true)
    try {
      const method = editing ? "PUT" : "POST"
      const res = await fetch("/api/holidays", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing?.id, name, date }),
      })
      if (res.ok) {
        toast.success(editing ? "Holiday updated" : "Holiday added")
        setOpen(false)
        fetchHolidays()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return
    try {
      const res = await fetch(`/api/holidays?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Holiday deleted")
        fetchHolidays()
      }
    } catch (err) {
      toast.error("Failed to delete holiday")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Public Holidays</h1>
          <p className="text-slate-500">Manage the annual holiday calendar for leave calculations.</p>
        </div>
        {isAdmin && (
          <Button onClick={handleOpenAdd} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> Add Holiday
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[300px]">Holiday Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
                  </TableCell>
                </TableRow>
              ) : holidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-slate-400">
                    No holidays found. Add one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                holidays.map((h) => {
                  const d = new Date(h.date)
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium text-slate-800">{h.name}</TableCell>
                      <TableCell>{d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                      <TableCell className="text-slate-500">{d.toLocaleDateString('en-GB', { weekday: 'long' })}</TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(h)}>
                              <Edit2 className="w-4 h-4 text-slate-400 hover:text-indigo-600" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(h.id)}>
                              <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Holiday" : "Add New Holiday"}</DialogTitle>
            <DialogDescription>
              Enter the details for the public holiday. These days are excluded from leave deductions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Holiday Name</Label>
              <Input
                id="name"
                placeholder="e.g. Independence Day"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? "Saving..." : editing ? "Update Holiday" : "Add Holiday"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
