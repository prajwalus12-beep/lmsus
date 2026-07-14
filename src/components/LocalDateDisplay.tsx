"use client"

import { useEffect, useState } from "react"

export function LocalDateDisplay({ date, includeTime = true }: { date: string | Date | null | undefined; includeTime?: boolean }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!date) return <span>—</span>

  const d = typeof date === 'string' ? new Date(date) : date

  // While rendering on the server, show a simple date-only string or ISO string to avoid mismatch.
  // Once mounted in the browser, replace it with the user's local timezone format.
  if (!mounted) {
    try {
      return <span>{d.toISOString().split('T')[0]}</span>
    } catch (e) {
      return <span>—</span>
    }
  }

  try {
    return <span>{includeTime ? d.toLocaleString() : d.toLocaleDateString()}</span>
  } catch (e) {
    return <span>—</span>
  }
}
