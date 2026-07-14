"use client"

import { useState, useMemo, useEffect } from "react"
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  addDays,
  subDays
} from "date-fns"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export function CalendarClient({ requests: allRequests, holidays, departments, initialDateStr }: { 
  requests: any[], 
  holidays: any[], 
  departments: string[],
  currentUserId?: string,
  initialDateStr?: string
}) {
  const [currentDate, setCurrentDate] = useState(initialDateStr ? new Date(initialDateStr) : new Date())
  const [view, setView] = useState("month")
  const [filterDept, setFilterDept] = useState<string>("ALL")
  const [onlyMine, setOnlyMine] = useState(false)

  // My leaves fetched from the server-side API (no client ID matching needed)
  const [myLeaves, setMyLeaves] = useState<any[] | null>(null)
  const [myLeavesLoading, setMyLeavesLoading] = useState(false)
  const [myLeavesError, setMyLeavesError] = useState<string | null>(null)

  // Eagerly fetch my leaves on mount so data is ready when filter is toggled
  useEffect(() => {
    const fetchMyLeaves = async () => {
      setMyLeavesLoading(true)
      setMyLeavesError(null)
      try {
        const res = await fetch('/api/leave/my-calendar')
        if (!res.ok) {
          const err = await res.json()
          setMyLeavesError(err.error || 'Failed to load your leaves')
          return
        }
        const data = await res.json()
        setMyLeaves(data.requests || [])
      } catch (e: any) {
        setMyLeavesError(e.message)
      } finally {
        setMyLeavesLoading(false)
      }
    }
    fetchMyLeaves()
  }, [])

  const next = () => {
    if (view === "month") setCurrentDate(addMonths(currentDate, 1))
    else if (view === "week") setCurrentDate(addDays(currentDate, 7))
    else if (view === "day") setCurrentDate(addDays(currentDate, 1))
    else if (view === "year") setCurrentDate(new Date(currentDate.getFullYear() + 1, 0, 1))
  }
  
  const prev = () => {
    if (view === "month") setCurrentDate(subMonths(currentDate, 1))
    else if (view === "week") setCurrentDate(subDays(currentDate, 7))
    else if (view === "day") setCurrentDate(subDays(currentDate, 1))
    else if (view === "year") setCurrentDate(new Date(currentDate.getFullYear() - 1, 0, 1))
  }

  // Active dataset:
  // - onlyMine=false → allRequests (show all approved team leaves by default)
  // - onlyMine=true  → server-fetched leaves for current user only
  const activeRequests = onlyMine ? (myLeaves ?? []) : allRequests

  const filteredRequests = useMemo(() => {
    return activeRequests.filter(r => {
      return filterDept === "ALL" || r.department === filterDept
    })
  }, [activeRequests, filterDept])

  const getDayRequests = (day: Date) => {
    return filteredRequests.filter(r => {
      const dayTs = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
      const s = new Date(r.startDate)
      const e = new Date(r.endDate)
      const startTs = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime()
      const endTs = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime()
      return dayTs >= startTs && dayTs <= endTs
    })
  }

  const renderMonthGrid = (date: Date) => {
    const start = startOfMonth(date)
    const end = endOfMonth(date)
    const days = eachDayOfInterval({ start, end })
    const startOffset = start.getDay()

    return (
      <div className="grid grid-cols-7 gap-px bg-slate-200 border rounded-lg overflow-hidden">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="bg-slate-50 py-2 text-center text-xs font-semibold text-slate-500 border-b">
            {day}
          </div>
        ))}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-slate-50/30 min-h-[80px]" />
        ))}
        {days.map((day, i) => {
          const isHoliday = holidays.find(h => isSameDay(new Date(h.date), day))
          const dayRequests = getDayRequests(day)
          const isToday = isSameDay(day, new Date())
          return (
            <div
              key={i}
              className={`min-h-[80px] bg-white p-1.5 border-b border-r ${
                !isSameMonth(day, date) ? "text-slate-300" : ""
              } ${isToday ? "bg-indigo-50/50" : ""}`}
            >
              <div className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                isToday ? "bg-indigo-600 text-white" : ""
              }`}>
                {format(day, "d")}
              </div>
              {isHoliday && (
                <div className="bg-red-50 text-red-600 text-[10px] px-1 py-0.5 rounded border border-red-100 truncate mb-0.5" title={isHoliday.name}>
                  H: {isHoliday.name}
                </div>
              )}
              {dayRequests.map(req => {
                const isL1 = req.status === "L1_APPROVED"
                return (
                  <div
                    key={req.id}
                    className={`text-[10px] px-1 py-0.5 rounded truncate border mb-0.5 ${
                      onlyMine
                        ? isL1
                          ? "bg-emerald-50/50 text-emerald-600 border-emerald-200 border-dashed"
                          : "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : isL1
                          ? "bg-blue-50/60 text-blue-700 border-blue-200 border-dashed"
                          : "bg-indigo-50 text-indigo-700 border-indigo-100"
                    }`}
                    title={`${req.title} (${isL1 ? 'L1 Approved - Pending HR' : 'HR Approved - Confirmed'})`}
                  >
                    {onlyMine
                      ? `${req.title.split(" - ")[1] || req.title}${isL1 ? ' (L1)' : ''}`
                      : `${req.title.split(" - ")[0] || req.title}${isL1 ? ' (L1)' : ''}`}
                  </div>
                )
              })}
            </div>
          );
        })}
      </div>
    )
  }

  const handleToggleMine = () => {
    setOnlyMine(prev => !prev)
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold text-slate-800">
            {view === "year" ? format(currentDate, "yyyy") : format(currentDate, "MMMM yyyy")}
          </h2>
          <div className="flex items-center space-x-1">
            <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => setCurrentDate(new Date())} size="sm">Today</Button>
            <Button variant="outline" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={setView} className="w-auto">
            <TabsList>
              <TabsTrigger value="year">Year</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Department:</span>
          <Select value={filterDept} onValueChange={v => v && setFilterDept(v)}>
            <SelectTrigger className="w-[160px] bg-white h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Departments</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {myLeavesError && (
            <span className="text-xs text-red-500 font-medium">⚠️ {myLeavesError}</span>
          )}
          <Button
            variant={onlyMine ? "default" : "outline"}
            size="sm"
            onClick={handleToggleMine}
            className={onlyMine ? "bg-indigo-600 hover:bg-indigo-700" : ""}
            disabled={myLeavesLoading}
          >
            {myLeavesLoading ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Loading...</>
            ) : onlyMine ? (
              "✓ Showing Only My Leaves"
            ) : (
              "Show Only My Leaves"
            )}
          </Button>
        </div>
      </div>

      {/* Calendar Views */}
      <div className="flex-1 overflow-y-auto">
        {view === "month" && renderMonthGrid(currentDate)}

        {view === "year" && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-8">
            {eachMonthOfInterval({
              start: startOfYear(currentDate),
              end: endOfYear(currentDate)
            }).map((month, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="text-sm font-bold text-slate-700 ml-1">{format(month, "MMMM")}</h3>
                {renderMonthGrid(month)}
              </div>
            ))}
          </div>
        )}

        {view === "week" && (
          <div className="grid grid-cols-7 gap-4">
            {eachDayOfInterval({
              start: startOfWeek(currentDate),
              end: endOfWeek(currentDate)
            }).map((day, idx) => {
              const isHoliday = holidays.find(h => isSameDay(new Date(h.date), day))
              const dayRequests = getDayRequests(day)
              return (
                <div key={idx} className={`border rounded-lg p-3 min-h-[400px] bg-white ${isSameDay(day, new Date()) ? "border-indigo-500 ring-1 ring-indigo-500" : ""}`}>
                  <div className="text-sm font-bold border-b pb-2 mb-3">
                    <div className="text-slate-500 uppercase text-[10px]">{format(day, "eee")}</div>
                    <div className="text-lg">{format(day, "d")}</div>
                  </div>
                  {isHoliday && (
                    <div className="bg-red-50 text-red-700 text-xs p-2 rounded border border-red-100 mb-2 font-medium">
                      Holiday: {isHoliday.name}
                    </div>
                  )}
                  <div className="space-y-2">
                    {dayRequests.map(req => {
                      const isL1 = req.status === "L1_APPROVED"
                      const bgClass = onlyMine
                        ? isL1
                          ? "bg-emerald-50/50 text-emerald-800 border-emerald-200 border-dashed"
                          : "bg-emerald-50 text-emerald-800 border-emerald-100"
                        : isL1
                          ? "bg-blue-50/60 text-blue-800 border-blue-200 border-dashed"
                          : "bg-indigo-50 text-indigo-800 border-indigo-100"
                      return (
                        <div
                          key={req.id}
                          className={`text-xs p-2 rounded border ${bgClass}`}
                          title={`${req.title} (${isL1 ? 'L1 Approved - Pending HR' : 'HR Approved - Confirmed'})`}
                        >
                          <div className="font-bold flex items-center justify-between gap-1">
                            <span>{req.title.split(" - ")[0]}</span>
                            {isL1 && <span className="text-[9px] bg-blue-100 text-blue-800 px-1 rounded font-normal shrink-0">L1</span>}
                          </div>
                          <div className="text-[10px] opacity-70">{req.title.split(" - ")[1]}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === "day" && (
          <div className="max-w-2xl mx-auto border rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
              <div>
                <div className="text-slate-500 uppercase text-xs font-bold tracking-wider">{format(currentDate, "EEEE")}</div>
                <div className="text-3xl font-bold">{format(currentDate, "do MMMM yyyy")}</div>
              </div>
              <Badge variant="outline" className="text-indigo-600 bg-indigo-50">Day View</Badge>
            </div>
            
            <div className="space-y-6">
              <section>
                <h4 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-tight">Public Holidays</h4>
                {holidays.filter(h => isSameDay(new Date(h.date), currentDate)).map(h => (
                  <div key={h.id} className="bg-red-50 text-red-800 p-4 rounded-lg border border-red-100 flex items-center gap-3">
                    <CalendarIcon className="w-5 h-5" />
                    <span className="font-bold">{h.name}</span>
                  </div>
                ))}
                {holidays.filter(h => isSameDay(new Date(h.date), currentDate)).length === 0 && (
                  <p className="text-slate-400 italic text-sm">None</p>
                )}
              </section>

              <section>
                <h4 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-tight">Approved Leaves</h4>
                 <div className="space-y-3">
                  {getDayRequests(currentDate).map(req => {
                    const isL1 = req.status === "L1_APPROVED"
                    return (
                      <div key={req.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">{req.title}</div>
                          <div className="text-sm text-slate-500">{req.department}</div>
                        </div>
                        <Badge variant={isL1 ? "outline" : "default"} className={isL1 ? "border-blue-200 text-blue-850 bg-blue-50" : "bg-emerald-600 text-white hover:bg-emerald-600"}>
                          {isL1 ? "L1 Approved" : "HR Approved"}
                        </Badge>
                      </div>
                    )
                  })}
                  {getDayRequests(currentDate).length === 0 && (
                    <p className="text-slate-400 italic text-sm">No leaves today.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {view === "list" && (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                <tr>
                  <th className="px-6 py-3">Employee / Holiday</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {holidays.filter(h => isSameMonth(new Date(h.date), currentDate)).map(h => (
                  <tr key={h.id} className="bg-red-50/30">
                    <td className="px-6 py-4 font-bold text-red-800">{h.name}</td>
                    <td className="px-6 py-4"><Badge className="bg-red-100 text-red-700">Holiday</Badge></td>
                    <td className="px-6 py-4">{format(new Date(h.date), "do MMM")}</td>
                    <td className="px-6 py-4">—</td>
                  </tr>
                ))}
                 {filteredRequests.filter(r => isSameMonth(new Date(r.startDate), currentDate)).map(req => {
                  const isL1 = req.status === "L1_APPROVED"
                  return (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-800">{req.title.split(" - ")[0]}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline">{req.title.split(" - ")[1]}</Badge>
                          <Badge variant={isL1 ? "outline" : "secondary"} className={isL1 ? "border-blue-200 bg-blue-50 text-blue-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}>
                            {isL1 ? "L1 Approved" : "HR Approved"}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {format(new Date(req.startDate), "do MMM")} – {format(new Date(req.endDate), "do MMM")}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{req.department}</td>
                    </tr>
                  )
                })}
                {filteredRequests.filter(r => isSameMonth(new Date(r.startDate), currentDate)).length === 0 &&
                  holidays.filter(h => isSameMonth(new Date(h.date), currentDate)).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">
                      No leaves or holidays this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
