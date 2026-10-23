/** A single-flight background loop. Foreground saves use their own debounce. */
export function startBackgroundPolling({ run, intervalMs, enabled = () => document.visibilityState === "visible", immediate = true }: {
  run: () => Promise<boolean | void>
  intervalMs: () => number
  enabled?: () => boolean
  immediate?: boolean
}) {
  let stopped = false
  let busy = false
  let failures = 0
  let retryAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = () => {
    clearTimeout(timer)
    if (stopped) return
    const delay = backgroundRetryDelay(intervalMs(), failures)
    timer = setTimeout(() => void tick(), delay + Math.random() * 250)
  }
  const tick = async () => {
    clearTimeout(timer)
    if (stopped || busy) return
    // Recheck local eligibility without network traffic, so edits/upload
    // completions made while hidden can resume durable retries.
    if (!enabled()) { schedule(); return }
    busy = true
    try { failures = await run() === false ? failures + 1 : 0 }
    catch { failures++ }
    finally {
      busy = false
      retryAt = failures ? Date.now() + backgroundRetryDelay(intervalMs(), failures) : 0
      schedule()
    }
  }
  const wake = () => {
    clearTimeout(timer)
    if (stopped || busy) return
    if (!enabled()) { schedule(); return }
    if (Date.now() < retryAt) timer = setTimeout(() => void tick(), retryAt - Date.now())
    else void tick()
  }
  document.addEventListener("visibilitychange", wake)
  window.addEventListener("online", wake)
  if (immediate) void tick()
  else schedule()
  return () => {
    stopped = true
    clearTimeout(timer)
    document.removeEventListener("visibilitychange", wake)
    window.removeEventListener("online", wake)
  }
}

export function backgroundRetryDelay(intervalMs: number, failures: number) {
  return Math.min(30_000, intervalMs * 2 ** Math.min(failures, 4))
}
