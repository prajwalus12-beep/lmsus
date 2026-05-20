"use client"

import { useState } from "react"
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
  isSameYear,
  addDays,
  subDays
} from "date-fns"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List as ListIcon, Grid3X3, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export function CalendarClient({ requests, holidays, departments, currentUserEmail }: { 
  requests: any[], 
  holidays: any[], 
  departments: string[],
  currentUserEmail?: string 
}) {
  const [currentDate, setCurrentDate] = useState(new Date("2026-06-01"))
  const [view, setView] = useState("month")
  const [filterDept, setFilterDept] = useState<string>("ALL")
  const [onlyMine, setOnlyMine] = useState(false)

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

  const filteredRequests = requests.filter(r => {
    const deptMatch = filterDept === "ALL" || r.department === filterDept
    const mineMatch = !onlyMine || r.email === currentUserEmail
    return deptMatch && mineMatch
  })

  const renderMonthGrid = (date: Date) => {
    const start = startOfMonth(date)
    const end = endOfMonth(date)
    const days = eachDayOfInterval({ start, end })
    const startOffset = start.getDay()

    return (
      <div className="grid grid-cols-7 gap-px bg-slate-200 border rounded-lg overflow-hidden bg-white">
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
          const dayRequests = filteredRequests.filter(r => {
            const s = new Date(r.startDate); const e = new Date(r.endDate)
            return day >= s && day <= e
          })
          return (
            <div key={i} className={`min-h-[80px] bg-white p-1.5 border-b border-r ${!isSameMonth(day, date) ? 'text-slate-300' : ''}`}>
              <div className="text-xs font-medium mb-1">{format(day, "d")}</div>
              {isHoliday && (
                <div className="bg-red-50 text-red-600 text-[10px] px-1 py-0.5 rounded border border-red-100 truncate mb-0.5" title={isHoliday.name}>
                  H: {isHoliday.name}
                </div>
              )}
              {dayRequests.map(req => (
                <div key={req.id} className="bg-indigo-50 text-indigo-700 text-[10px] px-1 py-0.5 rounded truncate border border-indigo-100 mb-0.5" title={req.title}>
                  {req.title}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full space-y-4">
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
          <Button 
            variant={onlyMine ? "default" : "outline"} 
            size="sm" 
            onClick={() => setOnlyMine(!onlyMine)}
            className={onlyMine ? "bg-indigo-600" : ""}
          >
            {onlyMine ? "Showing Only My Leaves" : "Show Only My Leaves"}
          </Button>
        </div>
      </div>

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
              const dayRequests = filteredRequests.filter(r => {
                const s = new Date(r.startDate); const e = new Date(r.endDate)
                return day >= s && day <= e
              })
              return (
                <div key={idx} className={`border rounded-lg p-3 min-h-[400px] bg-white ${isSameDay(day, new Date()) ? 'border-indigo-500 ring-1 ring-indigo-500' : ''}`}>
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
                    {dayRequests.map(req => (
                      <div key={req.id} className="bg-indigo-50 text-indigo-800 text-xs p-2 rounded border border-indigo-100">
                        <div className="font-bold">{req.title.split(" - ")[0]}</div>
                        <div className="text-[10px] opacity-70">{req.title.split(" - ")[1]}</div>
                      </div>
                    ))}
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
                )) || <p className="text-slate-400 italic text-sm">None</p>}
              </section>

              <section>
                <h4 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-tight">Approved Leaves</h4>
                <div className="space-y-3">
                  {filteredRequests.filter(r => {
                    const s = new Date(r.startDate); const e = new Date(r.endDate)
                    return currentDate >= s && currentDate <= e
                  }).map(req => (
                    <div key={req.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div className="font-bold text-slate-800">{req.title}</div>
                      <div className="text-sm text-slate-500">{req.department}</div>
                    </div>
                  ))}
                  {filteredRequests.filter(r => {
                    const s = new Date(r.startDate); const e = new Date(r.endDate)
                    return currentDate >= s && currentDate <= e
                  }).length === 0 && <p className="text-slate-400 italic text-sm">No leaves today.</p>}
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
                {filteredRequests.filter(r => isSameMonth(new Date(r.startDate), currentDate)).map(req => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{req.title.split(" - ")[0]}</td>
                    <td className="px-6 py-4"><Badge variant="outline">{req.title.split(" - ")[1]}</Badge></td>
                    <td className="px-6 py-4">
                      {format(new Date(req.startDate), "do MMM")} - {format(new Date(req.endDate), "do MMM")}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{req.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
