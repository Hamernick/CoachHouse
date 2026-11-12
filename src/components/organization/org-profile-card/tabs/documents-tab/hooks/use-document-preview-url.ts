"use client"

import { useEffect, useState } from "react"
import { useWorkspaceWindowHeaderActive } from "@/components/workspace/workspace-window-header-slots"
import { subscribeWorkspaceAccessChanged } from "@/lib/workspace/access-events"

type PreviewResult = { key: string; url: string | null; error: string | null }
type Options = { organizationId?: string; imageResponse?: boolean; revalidate?: boolean }

export function useDocumentPreviewUrl(
  path: string | undefined,
  version: string | undefined,
  enabled: boolean,
  { organizationId, imageResponse = false, revalidate = false }: Options = {},
) {
  const active = useWorkspaceWindowHeaderActive()
  const available = enabled && (!revalidate || active)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<PreviewResult | null>(null)
  const key = JSON.stringify([path, version, attempt, organizationId, imageResponse])

  useEffect(() => {
    setResult(null)
    if (!available || !path) return
    let disposed = false, retired = false, epoch = 0
    let request: AbortController | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    let objectUrl: string | undefined
    const release = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = undefined }
    const clear = () => { release(); setResult(null) }
    clear()
    const load = (supersede = false, discard = false) => {
      if (disposed || retired || (request && !supersede)) return
      const ticket = ++epoch
      request?.abort(); clearTimeout(timeout); request = undefined
      if (discard) clear()
      if (revalidate && document.visibilityState === "hidden") return
      const controller = new AbortController()
      request = controller
      const fail = () => {
        if (disposed || ticket !== epoch || retired) return
        retired = true; controller.abort(); clearTimeout(timeout); request = undefined; release()
        setResult({ key, url: null, error: "The document could not be loaded. Try again." })
      }
      timeout = setTimeout(fail, 15000)
      void (async () => {
        try {
          const target = new URL(path, window.location.origin)
          if (target.origin !== window.location.origin) throw new Error("Invalid preview source")
          if (organizationId) target.searchParams.set("organizationId", organizationId)
          const response = await fetch(target.href, { cache: "no-store", signal: controller.signal })
          if (!response.ok) throw new Error("Unavailable")
          let nextUrl: string, blob: Blob | undefined
          if (imageResponse) {
            if (!/^image\/(png|jpeg|gif|webp|avif)(?:;|$)/i.test(response.headers.get("content-type") ?? "")) throw new Error("Invalid image")
            blob = await response.blob()
            if (!blob.size || blob.size > 5 * 1024 * 1024) throw new Error("Invalid image size")
          } else {
            const payload = await response.json()
            if (typeof payload?.url !== "string") throw new Error("Invalid document link")
            const url = new URL(payload.url, window.location.origin)
            if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid document link")
            nextUrl = url.href
          }
          if (disposed || ticket !== epoch || retired) return
          clearTimeout(timeout); request = undefined; release()
          if (blob) nextUrl = objectUrl = URL.createObjectURL(blob)
          setResult({ key, url: nextUrl!, error: null })
        } catch { if (!controller.signal.aborted) fail() }
      })()
    }
    const focus = () => load()
    const refresh = () => load(true)
    const invalidate = () => load(true, true)
    const unsubscribe = revalidate && organizationId ? subscribeWorkspaceAccessChanged(organizationId, invalidate) : undefined
    if (revalidate) {
      window.addEventListener("focus", focus)
      window.addEventListener("online", refresh)
      window.addEventListener("pageshow", refresh)
      window.addEventListener("pagehide", invalidate)
      document.addEventListener("visibilitychange", invalidate)
    }
    load()
    return () => {
      disposed = true; epoch++; request?.abort(); clearTimeout(timeout); release(); unsubscribe?.()
      window.removeEventListener("focus", focus)
      window.removeEventListener("online", refresh)
      window.removeEventListener("pageshow", refresh)
      window.removeEventListener("pagehide", invalidate)
      document.removeEventListener("visibilitychange", invalidate)
    }
  }, [available, key, path, organizationId, imageResponse, revalidate])

  return {
    url: available && result?.key === key ? result.url : null,
    error: available && result?.key === key ? result.error : null,
    retry: () => setAttempt(current => current + 1),
  }
}
