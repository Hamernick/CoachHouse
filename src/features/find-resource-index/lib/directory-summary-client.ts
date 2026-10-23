let cached: { count: number; expires: number } | null = null
let pending: Promise<number> | null = null

export function clearDirectorySummaryCache() {
  cached = null
  pending = null
}

async function fetchSummary() {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch("/api/public/nonprofits/summary", {
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) throw new Error("Directory count unavailable")
      const result = (await response.json()) as { count: number }
      if (!Number.isSafeInteger(result.count) || result.count < 0)
        throw new Error("Invalid directory count")
      return result.count
    } catch (error) {
      if (attempt === 2) throw error
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 250 : 750))
    }
  }
}

export function loadDirectorySummary(): Promise<number> {
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.count)
  if (pending) return pending
  pending = fetchSummary()
    .then((count) => {
      cached = { count, expires: Date.now() + 300_000 }
      return count
    })
    .finally(() => { pending = null })
  return pending
}
