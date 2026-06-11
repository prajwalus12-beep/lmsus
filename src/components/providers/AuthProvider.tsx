"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

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

  const fetchSession = async (user: any) => {
    if (!user) {
      setSession(null)
      setStatus("unauthenticated")
      return
    }

    try {
      // Query profiles and departments from Supabase
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*, departments(name)')
        .eq('id', user.id)
        .single()

      if (error || !profile) {
        setSession({
          user: {
            id: user.id,
            name: user.user_metadata?.name || 'Employee',
            email: user.email || '',
            role: user.user_metadata?.role || 'EMPLOYEE',
            department: 'N/A'
          }
        })
      } else {
        setSession({
          user: {
            id: user.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            department: profile.departments?.name || 'N/A'
          }
        })
      }
      setStatus("authenticated")
    } catch (err) {
      console.error("Error fetching session:", err)
      setStatus("unauthenticated")
    }
  }

  useEffect(() => {
    // 1. Initial session check
    supabase.auth.getUser().then(({ data: { user } }) => {
      fetchSession(user)
    })

    // 2. Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (newSession?.user) {
        await fetchSession(newSession.user)
      } else {
        setSession(null)
        setStatus("unauthenticated")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    // scope: 'global' revokes the server-side refresh token immediately.
    // Without this, the middleware's auth.getUser() still validates the JWT
    // until it expires (~1 hour), making logout ineffective.
    await supabase.auth.signOut({ scope: 'global' })
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
