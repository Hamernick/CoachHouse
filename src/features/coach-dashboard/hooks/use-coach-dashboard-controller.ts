"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
export function useCoachDashboardController() {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh()
    }
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener("focus", refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [router])
}
