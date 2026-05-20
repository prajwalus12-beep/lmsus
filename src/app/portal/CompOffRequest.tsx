"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { submitCompOffWork } from "./actions";

export function CompOffRequest({ userId }: { userId: string }) {
  const [dateWorked, setDateWorked] = useState("");
  const [hoursWorked, setHoursWorked] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hours = parseFloat(hoursWorked);
    if (isNaN(hours) || hours < 4) {
      toast.error("Comp-off eligible only if minimum work hours is 4 or more.");
      return;
    }

    setLoading(true);
    try {
      const res = await submitCompOffWork({
        userId,
        dateWorked,
        hoursWorked: hours,
        reason,
      });
      if (res.success) {
        toast.success("Comp-off request submitted for approval.");
        setDateWorked("");
        setHoursWorked("");
        setReason("");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dateWorked">Date Worked (Holiday/Weekend)</Label>
          <Input 
            id="dateWorked" 
            type="date" 
            value={dateWorked} 
            onChange={(e) => setDateWorked(e.target.value)} 
            required 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hoursWorked">Hours Worked</Label>
          <Input 
            id="hoursWorked" 
            type="number" 
            step="0.5" 
            min="4" 
            max="24" 
            value={hoursWorked} 
            onChange={(e) => setHoursWorked(e.target.value)} 
            required 
            placeholder="e.g. 8"
          />
          <p className="text-xs text-slate-500">Min 4 hrs = 0.5 days, 8+ hrs = 1 day</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="compReason">Reason / Project</Label>
        <Textarea 
          id="compReason" 
          placeholder="Describe the work done..." 
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Submitting..." : "Log Comp-Off Work"}
      </Button>
    </form>
  );
}
