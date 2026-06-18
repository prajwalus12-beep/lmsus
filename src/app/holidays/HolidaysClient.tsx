"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "@/components/providers/AuthProvider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit2, Trash2, Calendar, Loader2, List, Download } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"

  const fetchHolidays = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/holidays")
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || "Failed to load holidays")
        setHolidays([])
        return
      }
      setHolidays(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error("Network error loading holidays")
      setHolidays([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHolidays()
  }, [fetchHolidays])

  const filteredHolidays = holidays.filter(h => new Date(h.date).getFullYear() === selectedYear)
  const years = Array.from(new Set(holidays.map(h => new Date(h.date).getFullYear()))).sort()
  if (!years.includes(new Date().getFullYear())) years.push(new Date().getFullYear())

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

  const handleExportCSV = () => {
    const headers = ["Holiday Name", "Date", "Day"]
    const rows = filteredHolidays.map(h => {
      const d = new Date(h.date)
      return [
        h.name,
        d.toLocaleDateString('en-GB'),
        d.toLocaleDateString('en-GB', { weekday: 'long' })
      ]
    })

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.body.appendChild(document.createElement("a"))
    link.href = URL.createObjectURL(blob)
    link.download = `holidays_${selectedYear}.csv`
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Public Holidays</h1>
          <p className="text-slate-500">View and manage the annual holiday calendar.</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v || ""))}>
            <SelectTrigger className="w-32 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          {isAdmin && (
            <Button onClick={handleOpenAdd} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" /> Add Holiday
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="w-4 h-4" /> List View
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Calendar View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
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
                  ) : filteredHolidays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-slate-400">
                        No holidays found for {selectedYear}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHolidays.map((h) => {
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
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {Array.from({ length: 12 }).map((_, i) => {
                  const monthDate = new Date(selectedYear, i, 1)
                  const monthHolidays = filteredHolidays.filter(h => new Date(h.date).getMonth() === i)
                  
                  return (
                    <div key={i} className="space-y-3">
                      <h3 className="font-bold text-slate-900 border-b pb-2">
                        {monthDate.toLocaleString('default', { month: 'long' })}
                      </h3>
                      <div className="space-y-1.5">
                        {monthHolidays.length > 0 ? monthHolidays.map(h => (
                          <div key={h.id} className="flex items-center gap-2 p-2 bg-indigo-50 border border-indigo-100 rounded text-xs">
                            <span className="font-bold text-indigo-700">
                              {new Date(h.date).getDate()}
                            </span>
                            <span className="text-indigo-600 truncate" title={h.name}>{h.name}</span>
                          </div>
                        )) : (
                          <p className="text-[10px] text-slate-400 italic py-1">No holidays</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
