"use client"

import { useEffect, useState } from "react"
import { calendarDay } from "../../lib/task-board"

// The server cannot infer the browser's timezone. Keep SSR and the first
// hydration render identical, then share one local day across all task views.
export function useTaskCalendarDay() {
  const [today, setToday] = useState<string | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const now = new Date()
      setToday(calendarDay(now))
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = setTimeout(refresh, midnight.getTime() - now.getTime())
    }
    const onVisible = () => { if (document.visibilityState === "visible") refresh() }
    refresh()
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])
  return today
}
