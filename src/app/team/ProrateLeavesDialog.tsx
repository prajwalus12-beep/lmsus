"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { saveProratedBalances } from "./actions"

interface ProrateLeavesDialogProps {
  user: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => void
}

export function ProrateLeavesDialog({ user, open, onOpenChange, onRefresh }: ProrateLeavesDialogProps) {
  const [plAllowance, setPlAllowance] = useState("0")
  const [clAllowance, setClAllowance] = useState("7")
  const [slAllowance, setSlAllowance] = useState("7")

  const [proratedPl, setProratedPl] = useState(0)
  const [proratedCl, setProratedCl] = useState(0)
  const [proratedSl, setProratedSl] = useState(0)

  const [loading, setLoading] = useState(false)

  // Calculate remaining fraction of the year based on join date
  const getRemainingFraction = () => {
    if (!user?.joinDate) return 1
    const join = new Date(user.joinDate)
    const year = join.getFullYear()
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31)
    
    const totalDays = (endOfYear.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24) + 1
    const daysWorked = (join.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
    const remainingDays = totalDays - daysWorked
    
    return Math.max(0, Math.min(1, remainingDays / totalDays))
  }

  const fraction = getRemainingFraction()
  const remainingMonths = Math.round(fraction * 12 * 10) / 10

  useEffect(() => {
    if (user) {
      const frac = getRemainingFraction()
      // Default calculations (rounded to nearest 0.5)
      const roundToHalf = (val: number) => Math.round(val * 2) / 2
      setProratedPl(roundToHalf(parseFloat(plAllowance) * frac))
      setProratedCl(roundToHalf(parseFloat(clAllowance) * frac))
      setProratedSl(roundToHalf(parseFloat(slAllowance) * frac))
    }
  }, [user, plAllowance, clAllowance, slAllowance])

  if (!user) return null

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await saveProratedBalances(user.id, {
        pl: proratedPl,
        cl: proratedCl,
        sl: proratedSl
      })

      if (res.success) {
        toast.success(`Balances prorated and saved successfully for ${user.name}`)
        onOpenChange(false)
        onRefresh()
      } else {
        toast.error("Failed to save prorated balances")
      }
    } catch (e: any) {
      toast.error(e.message || "Error saving balances")
    } finally {
      setLoading(false)
    }
  }

  const formattedJoinDate = user.joinDate 
    ? new Date(user.joinDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-")
    : "—"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Prorate Leaves: {user.name}</DialogTitle>
          <DialogDescription>
            Calculate and initialize leave balances proportionally based on joining date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
            <div>
              <span className="text-slate-500 block text-xs">Joined Date</span>
              <span className="font-semibold text-slate-800">{formattedJoinDate}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Remaining Year</span>
              <span className="font-semibold text-slate-800">
                {Math.round(fraction * 100)}% ({remainingMonths} months)
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Annual Allowances</h3>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Annual PL</Label>
                <Input 
                  type="number" 
                  value={plAllowance} 
                  onChange={e => setPlAllowance(e.target.value)} 
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Annual CL</Label>
                <Input 
                  type="number" 
                  value={clAllowance} 
                  onChange={e => setClAllowance(e.target.value)} 
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Annual SL</Label>
                <Input 
                  type="number" 
                  value={slAllowance} 
                  onChange={e => setSlAllowance(e.target.value)} 
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600">Calculated Prorated Balances (Edit to override)</h3>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-indigo-900 font-semibold">Prorated PL</Label>
                <Input 
                  type="number" 
                  step="0.5"
                  value={proratedPl} 
                  onChange={e => setProratedPl(parseFloat(e.target.value) || 0)} 
                  className="mt-1 border-indigo-200 focus:border-indigo-500"
                />
              </div>
              <div>
                <Label className="text-xs text-indigo-900 font-semibold">Prorated CL</Label>
                <Input 
                  type="number" 
                  step="0.5"
                  value={proratedCl} 
                  onChange={e => setProratedCl(parseFloat(e.target.value) || 0)} 
                  className="mt-1 border-indigo-200 focus:border-indigo-500"
                />
              </div>
              <div>
                <Label className="text-xs text-indigo-900 font-semibold">Prorated SL</Label>
                <Input 
                  type="number" 
                  step="0.5"
                  value={proratedSl} 
                  onChange={e => setProratedSl(parseFloat(e.target.value) || 0)} 
                  className="mt-1 border-indigo-200 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
            {loading ? "Saving..." : "Save Balances"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
