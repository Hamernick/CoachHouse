"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PublicMapResourceCategoryKey } from "@/lib/public-map/resource-categories"
import { loadNonprofitDirectoryPage } from "../lib/nonprofit-directory-client"
import { nonprofitDirectoryMapItem } from "../lib/nonprofit-map-item"
import type { NonprofitDirectorySearchResponse } from "../nonprofit-types"

type PageState = {
  key: string
  data?: NonprofitDirectorySearchResponse
  pending: boolean
  error: string | null
}
export function useNonprofitDirectory(
  query: string,
  category: PublicMapResourceCategoryKey | "all",
  enabled: boolean
) {
  const key = JSON.stringify([query.trim(), category, enabled])
  const valid =
    enabled && query.trim().length !== 1 && query.trim().length <= 160
  const [state, setState] = useState<PageState>({
    key: "",
    pending: false,
    error: null,
  })
  const [retryVersion, setRetryVersion] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const generation = useRef(0)
  const pendingMore = useRef(false)
  const latest = useRef(state)
  latest.current = state
  useEffect(() => {
    const version = ++generation.current
    const controller = new AbortController()
    pendingMore.current = false
    setLoadingMore(false)
    if (!valid) return () => controller.abort()
    setState({ key, pending: true, error: null })
    void loadNonprofitDirectoryPage(
      query.trim(),
      null,
      controller.signal,
      category === "all" ? null : category
    )
      .then((data) => {
        if (!controller.signal.aborted && generation.current === version)
          setState({ key, data, pending: false, error: null })
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({
            key,
            pending: false,
            error: "Some directory listings could not load.",
          })
      })
    return () => controller.abort()
  }, [key, query, category, valid, retryVersion])
  const data = valid && state.key === key ? state.data : undefined
  const loadMore = useCallback(async () => {
    const current = latest.current
    if (
      !valid ||
      current.key !== key ||
      !current.data?.page.nextCursor ||
      pendingMore.current
    )
      return false
    const version = generation.current
    pendingMore.current = true
    setLoadingMore(true)
    try {
      const next = await loadNonprofitDirectoryPage(
        query.trim(),
        current.data.page.nextCursor,
        AbortSignal.timeout(8000),
        category === "all" ? null : category
      )
      if (generation.current !== version) return false
      setState({
        key,
        data: {
          ...next,
          items: [
            ...new Map(
              [...current.data.items, ...next.items].map((item) => [
                item.ein,
                item,
              ])
            ).values(),
          ],
        },
        pending: false,
        error: null,
      })
      return true
    } catch {
      if (generation.current === version)
        setState((previous) => ({
          ...previous,
          error: "More listings could not load. Try again.",
        }))
      return false
    } finally {
      if (generation.current === version) {
        pendingMore.current = false
        setLoadingMore(false)
      }
    }
  }, [key, query, category, valid])
  return {
    items: useMemo(
      () =>
        data?.items.map((item) =>
          nonprofitDirectoryMapItem(item, category === "all" ? null : category)
        ) ?? [],
      [data, category]
    ),
    pending: valid && (state.key !== key || state.pending),
    error: valid && state.key === key ? state.error : null,
    retry: useCallback(() => setRetryVersion((value) => value + 1), []),
    pagination: {
      key,
      hasMore: Boolean(data?.page.hasMore),
      loading: loadingMore,
      error: state.error,
      loadMore,
    },
  }
}
