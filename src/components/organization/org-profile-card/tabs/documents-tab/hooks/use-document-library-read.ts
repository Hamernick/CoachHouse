"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useWorkspaceWindowHeaderActive } from "@/components/workspace/workspace-window-header-slots"
import { subscribeWorkspaceAccessChanged } from "@/lib/workspace/access-events"

export type DocumentLibraryScope = { organizationId: string; userId: string }
export function documentLibraryUrl(path: string, scope: DocumentLibraryScope) {
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}${new URLSearchParams({ organizationId: scope.organizationId, expectedUserId: scope.userId })}`
}

/** One lifecycle per list, not per row. Never repopulate from obsolete reads or writes. */
export function useDocumentLibraryRead<T>(
  scope: DocumentLibraryScope,
  read: (signal: AbortSignal, scope: DocumentLibraryScope) => Promise<T>,
  refreshKey = "",
) {
  const active = useWorkspaceWindowHeaderActive()
  const key = JSON.stringify([scope.organizationId, scope.userId, refreshKey])
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>({ key, data: null, error: null })
  const epoch = useRef(0)
  const refreshRef = useRef<() => void>(() => {})
  const refresh = useCallback(() => refreshRef.current(), [])
  const captureUpdate = useCallback(() => {
    const version = epoch.current
    return (update: (current: T) => T) => {
      if (version !== epoch.current) return
      setState(current => current.key === key && current.data ? { ...current, data: update(current.data) } : current)
    }
  }, [key])

  useEffect(() => {
    let disposed = false
    let request: AbortController | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const cancel = () => { epoch.current++; request?.abort(); request = undefined; clearTimeout(timer) }
    const clear = () => setState({ key, data: null, error: null })
    const hide = () => { cancel(); clear() }
    const load = (invalidate = false) => {
      if (disposed || !active || (request && !invalidate)) return
      cancel()
      if (invalidate) clear()
      if (document.visibilityState === "hidden") return
      const version = epoch.current
      const controller = new AbortController()
      request = controller
      const fail = () => {
        if (disposed || version !== epoch.current) return
        cancel()
        setState({ key, data: null, error: "Documents unavailable. Try again." })
      }
      timer = setTimeout(fail, 15000)
      void read(controller.signal, { organizationId: scope.organizationId, userId: scope.userId }).then(data => {
        if (disposed || version !== epoch.current) return
        clearTimeout(timer); request = undefined
        setState({ key, data, error: null })
      }).catch(() => { if (!controller.signal.aborted) fail() })
    }
    const focus = () => load()
    const invalidate = () => load(true)
    const visibility = () => document.visibilityState === "hidden" ? hide() : invalidate()
    refreshRef.current = invalidate
    clear()
    const unsubscribe = active ? subscribeWorkspaceAccessChanged(scope.organizationId, invalidate) : undefined
    if (active) {
      window.addEventListener("focus", focus)
      window.addEventListener("online", invalidate)
      window.addEventListener("pageshow", invalidate)
      window.addEventListener("pagehide", hide)
      document.addEventListener("visibilitychange", visibility)
      load()
    }
    return () => {
      disposed = true; cancel(); unsubscribe?.(); refreshRef.current = () => {}
      window.removeEventListener("focus", focus)
      window.removeEventListener("online", invalidate)
      window.removeEventListener("pageshow", invalidate)
      window.removeEventListener("pagehide", hide)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [active, key, read, scope.organizationId, scope.userId])
  const current = active && state.key === key ? state : null
  return { data: current?.data ?? null, error: current?.error ?? null, loading: !current?.data && !current?.error, refresh, captureUpdate }
}
