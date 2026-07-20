"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface UserSession {
  id: string
  name: string
  email: string
  role: string
  department: string
}

interface SessionData {
  user: UserSession
}

interface AuthContextType {
  session: SessionData | null
  status: "loading" | "authenticated" | "unauthenticated"
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  status: "loading",
  signOut: async () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(null)
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading")

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session')
      if (res.ok) {
        const data = await res.json()
        if (data && data.user) {
          setSession(data)
          setStatus("authenticated")
          return
        }
      }
      setSession(null)
      setStatus("unauthenticated")
    } catch (err) {
      console.error("Error fetching session:", err)
      setSession(null)
      setStatus("unauthenticated")
    }
  }

  useEffect(() => {
    checkSession()
  }, [])

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (err) {
      console.error("SignOut fetch error:", err)
    }
    setSession(null)
    setStatus("unauthenticated")
    router.push("/login")
    router.refresh()
  }

  return (
    <AuthContext.Provider value={{ session, status, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useSession() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useSession must be used within an AuthProvider")
  }
  return {
    data: context.session,
    status: context.status
  }
}

export function useSignOut() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useSignOut must be used within an AuthProvider")
  }
  return context.signOut
}
