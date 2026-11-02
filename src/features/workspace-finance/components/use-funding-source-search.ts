"use client"
import { useEffect, useRef, useState } from "react"
import { searchOpportunityFundingSources } from "../funding-source-actions"
import type { OpportunitySourceOption } from "../lib/opportunity-sources"

type SearchState = { pending: boolean; options: OpportunitySourceOption[]; error: string | null }
export function useFundingSourceSearch(organizationId: string, query: string, disabled: boolean) {
  const [state, setState] = useState<SearchState | null>(null)
  const generation = useRef(0)
  const scope = useRef<AbortController | null>(null)
  const cache = useRef(new Map<string, OpportunitySourceOption[]>())
  useEffect(() => {
    const controller = new AbortController()
    scope.current = controller
    setState(null)
    return () => controller.abort()
  }, [organizationId, query, disabled])
  async function search() {
    if (disabled) return
    const request = ++generation.current
    const signal = scope.current?.signal
    const keyword = query.trim(), key = `${organizationId}:${keyword.toLocaleLowerCase()}`
    const cached = cache.current.get(key)
    if (cached) { setState({ pending: false, options: cached, error: null }); return }
    setState({ pending: true, options: [], error: null })
    try {
      const result = await searchOpportunityFundingSources({ organizationId, keyword })
      if (request !== generation.current || signal?.aborted) return
      if ("error" in result) setState({ pending: false, options: [], error: result.error })
      else {
        if (cache.current.size >= 5) cache.current.delete(cache.current.keys().next().value!)
        cache.current.set(key, result.options)
        setState({ pending: false, options: result.options, error: null })
      }
    } catch { if (request === generation.current && !signal?.aborted) setState({ pending: false, options: [], error: "Grants.gov couldn’t be searched. Try again." }) }
  }
  return { state, search }
}
