"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { FIND_PATH } from "@/lib/find/routes"

import { type PublicMapGroupFilterKey } from "./category-filter"
import type { PublicMapResourceGuideId } from "@/lib/public-map/resource-guide-ids"
import {
  buildPublicMapFilterHref,
  resolvePublicMapFilterUrlState,
} from "./filter-url-state"

const PUBLIC_MAP_FILTER_URL_SYNC_DELAY_MS = 150

export function usePublicMapFilterUrlState({
  onFilterChange,
  embedded = false,
}: {
  onFilterChange: () => void
  embedded?: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialFilterState = resolvePublicMapFilterUrlState(
    new URLSearchParams(searchParams.toString())
  )
  const [query, setQuery] = useState(initialFilterState.query)
  const [activeGroup, setActiveGroup] = useState<PublicMapGroupFilterKey>(
    initialFilterState.activeGroup
  )
  const [activeGuideId, setActiveGuideId] =
    useState<PublicMapResourceGuideId | null>(initialFilterState.activeGuideId)
  const filterStateRef = useRef(initialFilterState)
  const filterUrlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  useEffect(() => {
    const nextFilterState = resolvePublicMapFilterUrlState(
      new URLSearchParams(searchParams.toString())
    )
    const changed =
      filterStateRef.current.query !== nextFilterState.query ||
      filterStateRef.current.activeGroup !== nextFilterState.activeGroup ||
      filterStateRef.current.activeGuideId !== nextFilterState.activeGuideId

    filterStateRef.current = nextFilterState
    if (!changed) return

    if (!embedded || pathname === FIND_PATH) onFilterChange()
    setQuery(nextFilterState.query)
    setActiveGroup(nextFilterState.activeGroup)
    setActiveGuideId(nextFilterState.activeGuideId)
  }, [embedded, onFilterChange, pathname, searchParams])

  useEffect(
    () => () => {
      if (filterUrlSyncTimerRef.current) {
        clearTimeout(filterUrlSyncTimerRef.current)
      }
    },
    []
  )

  const replaceFilterHistory = useCallback(
    ({
      nextActiveGroup,
      nextActiveGuideId,
      nextQuery,
    }: {
      nextActiveGroup: PublicMapGroupFilterKey
      nextActiveGuideId: PublicMapResourceGuideId | null
      nextQuery: string
    }) => {
      const nextHref = buildPublicMapFilterHref({
        activeGroup: nextActiveGroup,
        activeGuideId: nextActiveGuideId,
        pathname: embedded ? FIND_PATH : pathname,
        query: nextQuery,
        searchParams: new URLSearchParams(searchParams.toString()),
      })
      filterStateRef.current = resolvePublicMapFilterUrlState(
        new URL(nextHref, window.location.origin).searchParams
      )
      window.history.replaceState({ homeProfileNavigation: false }, "", nextHref)
    },
    [embedded, pathname, searchParams]
  )

  const flushFilterHistory = useCallback(() => {
    if (!filterUrlSyncTimerRef.current) return
    clearTimeout(filterUrlSyncTimerRef.current)
    filterUrlSyncTimerRef.current = null
    replaceFilterHistory({ nextActiveGroup: activeGroup, nextActiveGuideId: activeGuideId, nextQuery: query })
  }, [activeGroup, activeGuideId, query, replaceFilterHistory])

  const scheduleFilterHistoryReplace = useCallback(
    (nextQuery: string, nextActiveGroup: PublicMapGroupFilterKey) => {
      if (filterUrlSyncTimerRef.current) {
        clearTimeout(filterUrlSyncTimerRef.current)
      }
      filterUrlSyncTimerRef.current = setTimeout(() => {
        filterUrlSyncTimerRef.current = null
        replaceFilterHistory({
          nextActiveGroup,
          nextActiveGuideId: null,
          nextQuery,
        })
      }, PUBLIC_MAP_FILTER_URL_SYNC_DELAY_MS)
    },
    [replaceFilterHistory]
  )

  const handleQueryChange = useCallback(
    (value: string) => {
      onFilterChange()
      setQuery(value)
      setActiveGroup("all")
      setActiveGuideId(null)
      scheduleFilterHistoryReplace(value, "all")
    },
    [onFilterChange, scheduleFilterHistoryReplace]
  )

  const handleActiveGroupChange = useCallback(
    (value: PublicMapGroupFilterKey) => {
      onFilterChange()
      setActiveGroup(value)
      setQuery("")
      if (filterUrlSyncTimerRef.current) {
        clearTimeout(filterUrlSyncTimerRef.current)
        filterUrlSyncTimerRef.current = null
      }
      replaceFilterHistory({
        nextActiveGroup: value,
        nextActiveGuideId: null,
        nextQuery: "",
      })
      setActiveGuideId(null)
    },
    [onFilterChange, replaceFilterHistory]
  )

  const handleGuideChange = useCallback(
    (value: PublicMapResourceGuideId | null) => {
      onFilterChange()
      setActiveGuideId(value)
      if (value) {
        setQuery("")
        setActiveGroup("all")
      }
      if (filterUrlSyncTimerRef.current) {
        clearTimeout(filterUrlSyncTimerRef.current)
        filterUrlSyncTimerRef.current = null
      }
      replaceFilterHistory({
        nextActiveGroup: value ? "all" : activeGroup,
        nextActiveGuideId: value,
        nextQuery: value ? "" : query,
      })
    },
    [activeGroup, onFilterChange, query, replaceFilterHistory]
  )

  return {
    flushFilterHistory,
    activeGroup,
    activeGuideId,
    handleActiveGroupChange,
    handleGuideChange,
    handleQueryChange,
    query,
    searchParams,
  }
}
