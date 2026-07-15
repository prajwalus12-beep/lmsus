"use client";
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { PuppyLoader } from "@/components/ui/PuppyLoader"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const isLoginPage = pathname === "/login" || pathname?.startsWith("/login/")

  // Reset loading state on pathname change (navigation complete)
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setIsNavigating(false)
    })
    return () => cancelAnimationFrame(handle)
  }, [pathname])

  // Intercept clicks on internal links to trigger loading state
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      let target = e.target as HTMLElement | null
      while (target && target.tagName !== 'A') {
        target = target.parentElement
      }

      if (target && target instanceof HTMLAnchorElement) {
        const href = target.getAttribute('href')
        const targetAttr = target.getAttribute('target')

        // Intercept internal links only
        if (
          href &&
          href.startsWith('/') &&
          !href.startsWith('/#') &&
          targetAttr !== '_blank'
        ) {
          try {
            const targetUrl = new URL(target.href)
            // Trigger loader if the destination pathname is different
            if (
              targetUrl.origin === window.location.origin &&
              targetUrl.pathname !== window.location.pathname
            ) {
              setIsNavigating(true)
            }
          } catch (err) {
            // Fallback check
            if (href !== pathname) {
              setIsNavigating(true)
            }
          }
        }
      }
    }

    document.addEventListener('click', handleLinkClick)
    return () => {
      document.removeEventListener('click', handleLinkClick)
    }
  }, [pathname])

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="h-full flex overflow-hidden w-full relative">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-[#F7F8FA] p-4 md:p-6 lg:p-8 relative">
          {isNavigating && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex flex-col items-center justify-center z-50">
              <PuppyLoader />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
