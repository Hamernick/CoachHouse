"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { loadFindResourceQuery } from "../lib/client-cache"
import type { FindResourceCatalogResponse } from "../lib/catalog-query"

export function useResourceQuery(url: string | null, paginate = false) {
  const [state, setState] = useState<{ url: string | null; data?: FindResourceCatalogResponse; pending: boolean; error: string | null }>({ url: null, pending: false, error: null })
  const [retryVersion, setRetryVersion] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const generation = useRef(0)
  const morePending = useRef(false)
  const latest = useRef(state)
  latest.current = state
  useEffect(() => {
    const version = ++generation.current
    morePending.current = false
    setLoadingMore(false)
    if (!url) return
    let disposed = false
    const refresh = async (force: boolean, background = false) => {
      if (!background) setState((previous) => ({ ...previous, pending: true, error: null }))
      try {
        const data = await loadFindResourceQuery(url, force)
        if (disposed || generation.current !== version) return
        setState((previous) => {
          // Preserve appended pages and object identity when the catalog is unchanged.
          if (previous.url === url && previous.data?.revision === data.revision) return { ...previous, pending: false, error: null }
          return { url, data, pending: false, error: null }
        })
      } catch {
        if (!disposed && generation.current === version) setState((previous) => ({ ...previous, pending: false, error: "The resource directory could not load." }))
      }
    }
    void refresh(retryVersion > 0)
    const refreshVisible = () => {
      if (document.visibilityState !== "hidden" && navigator.onLine !== false) void refresh(true, true)
    }
    const timer = window.setInterval(refreshVisible, 300_000)
    window.addEventListener("online", refreshVisible)
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener("online", refreshVisible) }
  }, [url, retryVersion])

  const loadMore = useCallback(async () => {
    const current = latest.current
    if (!url || current.url !== url || !current.data?.page.nextCursor || morePending.current) return false
    const version = generation.current
    const pageUrl = new URL(url, window.location.origin)
    pageUrl.searchParams.set("cursor", current.data.page.nextCursor)
    morePending.current = true
    setLoadingMore(true)
    try {
      const next = await loadFindResourceQuery(pageUrl.pathname + pageUrl.search)
      if (generation.current !== version) return false
      if (next.revision !== current.data.revision) { setRetryVersion((value) => value + 1); return false }
      setState((previous) => {
        if (previous.url !== url || !previous.data) return previous
        const items = new Map([...previous.data.resourceItems, ...next.resourceItems].map((item) => [item.id, item]))
        return { ...previous, error: null, data: { ...next, resourceItems: [...items.values()] } }
      })
      return true
    } catch {
      if (generation.current === version) setState((previous) => ({ ...previous, error: "More resources could not load. Try again." }))
      return false
    } finally {
      if (generation.current === version) { morePending.current = false; setLoadingMore(false) }
    }
  }, [url])
  const currentData = state.url === url ? state.data : undefined
  return {
    data: currentData,
    previousData: state.data,
    pending: Boolean(url) && (state.pending || (state.url !== url && !state.error)),
    error: state.error,
    retry: useCallback(() => setRetryVersion((value) => value + 1), []),
    pagination: { key: url ?? "", hasMore: paginate && Boolean(currentData?.page.hasMore), loading: loadingMore, error: state.error, loadMore },
  }
}
