"use client"

import { useEffect, useState } from "react"
import { loadDirectorySummary } from "../lib/directory-summary-client"
export function useDirectorySummary(enabled: boolean) {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled) return
    let disposed = false
    void loadDirectorySummary()
      .then((value) => {
        if (!disposed) setCount(value)
      })
      .catch(() => {})
    return () => {
      disposed = true
    }
  }, [enabled])
  return count
}
