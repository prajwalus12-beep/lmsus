"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2, ShieldCheck, Users, LogIn } from "lucide-react"
import { PuppyLoader } from "@/components/ui/PuppyLoader"

const TEST_ACCOUNTS = [
  {
    name: "Admin User",
    email: "admin@yopmail.com",
    role: "HR Admin",
    dept: "HR",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  },
  {
    name: "Rahul Verma",
    email: "manager@yopmail.com",
    role: "Manager",
    dept: "Engineering",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  {
    name: "John Doe",
    email: "john@yopmail.com",
    role: "Employee",
    dept: "Engineering",
    color: "bg-green-100 text-green-700 border-green-200",
    dot: "bg-green-500",
  },
  {
    name: "Alice Wong",
    email: "alice.wong@yopmail.com",
    role: "Employee",
    dept: "Sales",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  {
    name: "Diana Prince",
    email: "diana.prince@yopmail.com",
    role: "Employee (Probation)",
    dept: "Engineering",
    color: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    setLoading(false)
    if (!error && data?.user) {
      toast.success("Welcome back!")
      router.push("/")
      router.refresh()
    } else {
      let msg = error?.message || "Invalid email or password. Please try again."
      if (msg.includes("API key")) {
        msg = "Supabase API key is invalid. Please check your .env file."
      }
      toast.error(msg)
    }
  }

  const fillAccount = (acc: typeof TEST_ACCOUNTS[0]) => {
    setEmail(acc.email)
    setPassword("Unique@123")
    toast.info(`Filled: ${acc.name}`)
  }

  return (
    <div className="min-h-screen flex relative">
      {loading && (
        <div className="absolute inset-0 z-[100] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-indigo-600 font-bold animate-pulse">Running your login...</p>
        </div>
      )}
      {/* ── Left Branding Panel ── */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex-col justify-between p-12 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <span className="text-xl font-bold tracking-tight">LMS SaaS</span>
          </div>

          <h1 className="text-4xl font-extrabold leading-tight mb-4">
            Smart Leave<br />Management<br />for Modern Teams
          </h1>
          <p className="text-indigo-200 text-lg leading-relaxed">
            India-compliant leave policies, automated accruals, multi-level approvals, and rich reports — all in one place.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {[
            { icon: "✓", text: "Role-based access for HR, Managers & Employees" },
            { icon: "✓", text: "PL accrual per days worked (Factories Act)" },
            { icon: "✓", text: "Year-end closure & carry-forward automation" },
            { icon: "✓", text: "CSV & PDF reports with negative leave tracking" },
          ].map((item) => (
            <div key={item.text} className="flex items-start gap-3">
              <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 shrink-0">
                {item.icon}
              </div>
              <span className="text-indigo-100 text-sm">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Login Panel ── */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 bg-[#F7F8FA] overflow-y-auto">
        <div className="max-w-md w-full mx-auto">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">L</span>
            </div>
            <span className="font-bold text-slate-900">LMS SaaS</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Sign in to your account</h2>
            <p className="text-slate-500 text-sm">Use your company email and password to continue.</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4 mb-8">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700 font-medium">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="h-11 bg-white border-slate-200 focus:border-indigo-400"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="h-11 bg-white border-slate-200 focus:border-indigo-400 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in...</>
              ) : (
                <><LogIn className="w-4 h-4 mr-2" /> Sign In</>
              )}
            </Button>
          </form>

          {/* Test Accounts Panel */}
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-semibold text-slate-700">Test Accounts</span>
            </div>
            {/* Password banner */}
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <span className="text-xs text-amber-700 font-medium">🔑 Common password for all accounts:</span>
              <code className="text-sm font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 tracking-wide select-all">
                Unique@123
              </code>
            </div>
            <div className="divide-y divide-slate-100">
              {TEST_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillAccount(acc)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${acc.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{acc.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${acc.color}`}>
                        {acc.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{acc.email} · {acc.dept}</p>
                  </div>
                  <span className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    Fill ↗
                  </span>
                </button>
              ))}
            </div>
            <div className="px-4 py-2.5 bg-indigo-50 border-t border-indigo-100">
              <p className="text-xs text-indigo-600">
                💡 Click any account above to auto-fill the login form, then click Sign In.
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            LMS SaaS · Confidential · © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
