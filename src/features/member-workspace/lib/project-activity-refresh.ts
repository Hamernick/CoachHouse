import type { OrganizationActivityResult } from "./project-activity-types"

export function createActivityRefresh({
  load,
  onResult,
  onPending,
}: {
  load: () => Promise<OrganizationActivityResult>
  onResult: (result: OrganizationActivityResult) => void
  onPending: (pending: boolean) => void
}) {
  let pending = false
  let disposed = false
  return {
    async refresh() {
      if (pending || disposed) return
      pending = true
      onPending(true)
      try {
        const result = await load()
        if (!disposed) onResult(result)
      } catch {
        if (!disposed) onResult({ state: "error", items: [] })
      } finally {
        pending = false
        if (!disposed) onPending(false)
      }
    },
    dispose() {
      disposed = true
    },
  }
}

export function startVisibleActivityPolling(refresh: () => Promise<void>) {
  const refreshVisible = () => {
    if (document.visibilityState === "visible") void refresh()
  }
  refreshVisible()
  const timer = window.setInterval(refreshVisible, 30_000)
  window.addEventListener("focus", refreshVisible)
  document.addEventListener("visibilitychange", refreshVisible)
  return () => {
    window.clearInterval(timer)
    window.removeEventListener("focus", refreshVisible)
    document.removeEventListener("visibilitychange", refreshVisible)
  }
}
