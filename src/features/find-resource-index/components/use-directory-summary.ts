"use client"

import { useEffect, useState } from "react"
let cached: { count: number; expires: number } | null = null
let pending: Promise<number> | null = null
function loadSummary() {
  if (cached && cached.expires > Date.now())
    return Promise.resolve(cached.count)
  if (pending) return pending
  pending = fetch("/api/public/nonprofits/summary", {
    signal: AbortSignal.timeout(5000),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("Directory count unavailable")
      const result = (await response.json()) as { count: number }
      if (!Number.isSafeInteger(result.count) || result.count < 0)
        throw new Error("Invalid directory count")
      cached = { count: result.count, expires: Date.now() + 300_000 }
      return result.count
    })
    .finally(() => {
      pending = null
    })
  return pending
}
export function useDirectorySummary(enabled: boolean) {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled) return
    let disposed = false
    void loadSummary()
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
