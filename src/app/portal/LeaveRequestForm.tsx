"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertCircle, CalendarClock } from "lucide-react";
import { submitLeaveRequest } from "./actions";

export function LeaveRequestForm({ userId, balances, maxNegative }: { userId: string, balances: any, maxNegative: number }) {
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [halfDay, setHalfDay] = useState("NONE");
  const [loading, setLoading] = useState(false);

  // Server Projected State
  const [projectedDays, setProjectedDays] = useState(0);
  const [projectedBalanceMap, setProjectedBalanceMap] = useState<any>(null);
  const [convertedToPl, setConvertedToPl] = useState(false);
  const [isProjecting, setIsProjecting] = useState(false);

  const MAX_NEGATIVE = maxNegative || -5 // Rule 44: configurable minimum negative balance

  useEffect(() => {
    async function fetchProjection() {
      if (!startDate || !endDate || !type) {
        setProjectedDays(0);
        setProjectedBalanceMap(null);
        return;
      }
      setIsProjecting(true);
      try {
        const res = await fetch("/api/leave/project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, type, startDate, endDate, isHalfDay: halfDay !== "NONE" })
        });
        const data = await res.json();
        if (data.success) {
          setProjectedDays(data.days);
          setConvertedToPl(data.convertedToPl);
          setProjectedBalanceMap(data.projectedBalance);
        }
      } catch (err) {
        console.error("Failed to fetch projection", err);
      } finally {
        setIsProjecting(false);
      }
    }
    fetchProjection();
  }, [startDate, endDate, type, userId, halfDay]);

  // Use projected balances if available, otherwise fallback to current
  const targetBalances = projectedBalanceMap || balances;
  
  // Rule 37: If auto-converted to PL, show PL balance
  const activeType = convertedToPl ? "PL" : type;
  
  const balanceMap: any = { 
    PL: targetBalances.projectedPl ?? targetBalances.pl, 
    CL: targetBalances.cl, 
    SL: targetBalances.sl, 
    COMP: targetBalances.comp 
  };
  
  const currentBalance = activeType ? balanceMap[activeType] : 0;
  const netBalance = currentBalance - projectedDays;
  const wouldGoNegative = netBalance < 0;
  const exceedsNegativeLimit = netBalance < MAX_NEGATIVE; 
  const isSandwichWarning = type === 'CL' && projectedDays > 4 && !convertedToPl;
  const isCompNotAllowed = type === 'COMP' && wouldGoNegative; 

  const isFutureProjection = projectedBalanceMap && projectedBalanceMap.projectedDate > new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (exceedsNegativeLimit) {
      toast.error(`Cannot apply: net balance would be ${netBalance}, below the minimum allowed limit of ${MAX_NEGATIVE} days.`)
      return
    }
    if (isCompNotAllowed) {
      toast.error("Compensatory Off cannot go into negative balance. Apply for Loss of Pay instead.")
      return
    }
    setLoading(true)
    
    try {
      await submitLeaveRequest({
        userId,
        type, // Server re-verifies logic
        startDate,
        endDate,
        reason,
        isNegative: wouldGoNegative,
        negativeAmount: wouldGoNegative ? Math.abs(netBalance) : 0,
        attachmentUrl: documentUrl,
        halfDay
      })
      
      if (wouldGoNegative) {
        toast.warning(`Leave submitted with negative balance. Balance will be ${netBalance} days. Recovery may apply on exit.`)
      } else {
        toast.success("Leave request submitted successfully")
      }
      setType(""); setStartDate(""); setEndDate(""); setReason(""); setDocumentUrl(""); setHalfDay("NONE");
      setProjectedDays(0);
      setProjectedBalanceMap(null);
    } catch (err) {
      console.error(err)
      toast.error("Failed to submit leave request. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Leave Type</Label>
          <Select value={type} onValueChange={v => v && setType(v)} required>
            <SelectTrigger id="type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PL">Privilege Leave (PL)</SelectItem>
              <SelectItem value="CL">Casual Leave (CL)</SelectItem>
              <SelectItem value="SL">Sick Leave (SL)</SelectItem>
              <SelectItem value="COMP">Compensatory Off (COMP)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="halfDay">Half Day</Label>
          <Select value={halfDay} onValueChange={(v) => setHalfDay(v || "NONE")}>
            <SelectTrigger id="halfDay">
              <SelectValue placeholder="Select half day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">None</SelectItem>
              <SelectItem value="FIRST_HALF">First Half</SelectItem>
              <SelectItem value="SECOND_HALF">Second Half</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Textarea 
          id="reason" 
          placeholder="Please provide a justification for your request..." 
          value={reason}
          onChange={e => setReason(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="documentUrl">Web Link / Document URL (Optional)</Label>
        <Input 
          id="documentUrl" 
          placeholder="e.g. Google Drive link for medical certificate or documents" 
          value={documentUrl}
          onChange={e => setDocumentUrl(e.target.value)}
        />
        <p className="text-xs text-slate-500">Provide a link to supporting documents if required (Rule 46).</p>
      </div>

      {type === 'SL' && projectedDays > 2 && (
        <div className="space-y-2 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-800 flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4" />
            Medical Certificate Required
          </p>
          <p className="text-xs text-amber-700">Sick leaves exceeding 2 days require a medical certificate. Please paste the link above.</p>
        </div>
      )}

      {type && projectedDays > 0 && (
        <div className={`p-4 rounded-lg border space-y-2 ${wouldGoNegative ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'} ${isProjecting ? 'opacity-50' : ''}`}>
          
          {isFutureProjection && (
            <div className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 p-2 rounded mb-3 flex items-center gap-2">
              <CalendarClock className="w-4 h-4" />
              Showing projected balance for {startDate}
            </div>
          )}
          
          {convertedToPl && (
             <div className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded mb-3">
               <AlertCircle className="w-3 h-3 inline mr-1" />
               Continuous break exceeds limits. Request automatically converted to PL (Rule 37).
             </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Requested Days (Calculated):</span>
            <span className="font-medium">{projectedDays}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{isFutureProjection ? 'Projected Balance:' : 'Current Balance:'}</span>
            <span className="font-medium">{currentBalance.toFixed(1)}</span>
          </div>
          <div className="flex justify-between text-sm border-t pt-2 mt-2">
            <span className="font-medium text-slate-700">Net Balance After Request:</span>
            <span className={`font-bold ${netBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {netBalance.toFixed(1)}
            </span>
          </div>
          
          {wouldGoNegative && !exceedsNegativeLimit && (
            <div className="text-xs text-red-700 bg-red-100 rounded px-2 py-1 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              Leave allowed in negative balance. Recovery of {Math.abs(netBalance).toFixed(1)} days may apply upon exit.
            </div>
          )}
          {exceedsNegativeLimit && (
            <div className="text-xs text-red-800 font-semibold bg-red-100 rounded px-2 py-1 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              Exceeds minimum negative limit ({MAX_NEGATIVE} days). Request cannot be submitted.
            </div>
          )}
        </div>
      )}

      {isSandwichWarning && (
        <div className="text-xs text-amber-700 flex items-center gap-1 bg-amber-50 p-2 rounded border border-amber-200">
          <AlertCircle className="w-3 h-3" />
          Sandwich rule applies: weekends/holidays are included in your requested days.
        </div>
      )}

      <Button type="submit" className="w-full" disabled={exceedsNegativeLimit || isCompNotAllowed || loading || isProjecting}>
        {loading ? "Submitting..." : wouldGoNegative ? "Submit (Negative Balance)" : "Submit Request"}
      </Button>
    </form>
  )
}
