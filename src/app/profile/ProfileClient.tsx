"use client"

import { useState, useEffect } from "react"
import { useSession } from "@/components/providers/AuthProvider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, User as UserIcon, ShieldCheck, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"

export function ProfileClient() {
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [commEmail, setCommEmail] = useState("")
  
  // Password change states
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (session?.user) {
      fetch("/api/user/profile")
        .then(res => res.json())
        .then(data => {
          setCommEmail(data.communicationEmail || "")
          setFetching(false)
        })
    }
  }, [session])

  const handleUpdate = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communicationEmail: commEmail }),
      })
      if (res.ok) {
        toast.success("Profile updated")
      } else {
        toast.error("Failed to update profile")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill all password fields")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Password changed successfully")
        setOldPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        toast.error(data.error || "Failed to change password")
      }
    } catch (err) {
      toast.error("Network error. Try again.")
    } finally {
      setChangingPassword(false)
    }
  }

  if (fetching) {
    return <div className="flex items-center justify-center h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Profile</h1>
        <p className="text-slate-500">Manage your account settings and notification preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-indigo-600" /> Personal Information
          </CardTitle>
          <CardDescription>Basic account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-slate-500">Name</Label>
              <div className="font-medium">{session?.user?.name}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-500">Login Email</Label>
              <div className="font-medium text-slate-500">{session?.user?.email}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-500">Role</Label>
              <div className="flex items-center gap-1 text-indigo-700">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-bold">{(session?.user as any)?.role}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600" /> Communication Email
          </CardTitle>
          <CardDescription>This email will be used for all system notifications (Leaves, Accruals, etc.)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="commEmail">Notification Email Address</Label>
            <Input 
              id="commEmail" 
              value={commEmail} 
              onChange={(e) => setCommEmail(e.target.value)} 
              placeholder="Enter your personal/work email"
            />
            <p className="text-[10px] text-slate-400">Default: sandeepjain200019@gmail.com</p>
          </div>
          <Button onClick={handleUpdate} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
            {loading ? "Updating..." : "Save Preferences"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-600" /> Change Password
          </CardTitle>
          <CardDescription>Update your login credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oldPassword">Current Password</Label>
            <Input 
              id="oldPassword" 
              type="password"
              value={oldPassword} 
              onChange={(e) => setOldPassword(e.target.value)} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input 
                id="newPassword" 
                type="password"
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input 
                id="confirmPassword" 
                type="password"
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
              />
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword} className="bg-indigo-600 hover:bg-indigo-700">
            {changingPassword ? "Changing..." : "Change Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
