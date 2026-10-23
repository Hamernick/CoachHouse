"use client"

import { useEffect, useState } from "react"
import type { MemberWorkspaceAccessibleOrganization } from "@/features/member-workspace"
import { searchSupportOrganizationsOverHttp } from "../lib/search-transport"

type SearchState = {
  query: string
  offset: number
  matches: MemberWorkspaceAccessibleOrganization[]
  total: number
  hasMore: boolean
  searching: boolean
  error: string | null
}

export function useWorkspaceSupportSearch(enabled: boolean) {
  const [input, setInput] = useState("")
  const query = input.trim()
  const [offset, setOffset] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [state, setState] = useState<SearchState | null>(null)
  const active = enabled && query.length >= 2
  const current = active && state?.query === query && state.offset === offset ? state : null

  useEffect(() => {
    if (!active) return
    let canceled = false
    const controller = new AbortController()
    setState({ query, offset, matches: [], total: 0, hasMore: false, searching: true, error: null })
    const timeout = setTimeout(() => {
      void searchSupportOrganizationsOverHttp(query, offset, controller.signal).then((result) => {
        if (!canceled) setState({ query, offset, matches: result.organizations, total: result.total,
          hasMore: result.hasMore, searching: false, error: result.error ?? null })
      }).catch(() => {
        if (!canceled) setState({ query, offset, matches: [], total: 0, hasMore: false,
          searching: false, error: "Search unavailable. Try again." })
      })
    }, 250)
    return () => { canceled = true; clearTimeout(timeout); controller.abort() }
  }, [active, query, offset, refresh])

  return {
    query: input, setQuery: (next: string) => { setInput(next); setOffset(0) },
    active, offset, matches: current?.matches ?? [], total: current?.total ?? 0,
    hasMore: current?.hasMore ?? false, searching: active && (!current || current.searching),
    error: current?.error ?? null,
    retry: () => setRefresh((value) => value + 1),
    previous: () => setOffset(Math.max(0, offset - 20)),
    next: () => setOffset(offset + 20),
  }
}
