import { z } from "zod"

const metadataSchema = z.object({
  title: z.string().max(2048).nullable().optional(),
  description: z.string().max(8192).nullable().optional(),
  image: z.url({ protocol: /^https?$/ }).nullable().optional(),
})
export type PreviewMetadata = z.infer<typeof metadataSchema>

/** One editor owns this queue. No global private-content cache or retry timer. */
export function createLinkPreviewQueue({
  fetchPreview,
  onResult,
  concurrency = 3,
  requestBudget = 64,
}: {
  fetchPreview: (url: string, signal: AbortSignal) => Promise<Response>
  onResult: (url: string, metadata: PreviewMetadata) => void
  concurrency?: number
  requestBudget?: number
}) {
  const results = new Map<string, PreviewMetadata>()
  const pending = new Map<string, AbortController>()
  const paused = new WeakSet<AbortController>()
  const queue: string[] = []
  let desired = new Set<string>()
  let active = false
  let disposed = false
  let unavailable = false
  let requests = 0
  const maxConcurrent = Math.max(1, Math.min(4, Math.floor(concurrency)))
  const budget = Math.max(0, Math.min(128, Math.floor(requestBudget)))

  function pump() {
    if (!active || disposed || unavailable) return
    while (pending.size < maxConcurrent && queue.length && requests < budget) {
      const url = queue.shift()
      if (!url) continue
      if (!desired.has(url) || results.has(url) || pending.has(url)) continue
      const controller = new AbortController()
      pending.set(url, controller)
      requests += 1
      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, 10_000)
      void Promise.resolve()
        .then(() => {
          if (controller.signal.aborted) throw new Error("Preview canceled")
          return fetchPreview(url, controller.signal)
        })
        .then(async (response) => {
          if (response.status === 410) unavailable = true
          if (!response.ok) throw new Error("Preview unavailable")
          return metadataSchema.parse(await response.json())
        })
        .catch(() => ({}))
        .then((metadata) => {
          if (disposed || (controller.signal.aborted && !timedOut)) return
          results.set(url, metadata)
          if (active && desired.has(url)) onResult(url, metadata)
        })
        .finally(() => {
          clearTimeout(timeout)
          // An old completion cannot remove a newer request for this URL.
          if (pending.get(url) === controller) pending.delete(url)
          if (paused.has(controller) && active && desired.has(url) && !disposed)
            queue.push(url)
          pump()
        })
    }
  }

  return {
    update(urls: readonly string[], enabled: boolean) {
      if (disposed) return
      active = enabled
      desired = new Set(urls.filter((url) => /^https?:\/\//i.test(url)))
      queue.length = 0
      for (const [url, controller] of pending) {
        if (!active || !desired.has(url)) {
          paused.add(controller)
          controller.abort()
        }
      }
      if (!active || unavailable) return
      for (const url of desired) {
        if (!results.has(url) && !pending.has(url)) queue.push(url)
      }
      pump()
    },
    dispose() {
      disposed = true
      queue.length = 0
      for (const controller of pending.values()) controller.abort()
      results.clear()
    },
  }
}
