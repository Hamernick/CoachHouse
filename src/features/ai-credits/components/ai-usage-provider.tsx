"use client"

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react"
import { loadCurrentAiUsage } from "../usage-summary-actions"
import type { AiCreditAccount } from "../types"

type Quote = { organizationId: string; maximumCredits: number; provider?: string; model?: string }
type Usage = {
  data: { organizationId: string; account: AiCreditAccount } | null
  error: string | null; loading: boolean; refresh: () => void
  manageRequest: number; openManage: () => void
  quote: (Quote & { owner: string }) | null
  setQuote: React.Dispatch<React.SetStateAction<(Quote & { owner: string }) | null>>
}
const UsageContext = createContext<Usage | null>(null)
export const useAiUsage = () => useContext(UsageContext)

export function AiUsageProvider({ children, enabled, scope }: { children: ReactNode; enabled: boolean; scope: string }) {
  const [data, setData] = useState<Usage["data"]>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [quote, setQuote] = useState<Usage["quote"]>(null)
  const [manageRequest, setManageRequest] = useState(0)
  const openManage = useCallback(() => setManageRequest(value => value + 1), [])
  const generation = useRef(0)
  const pending = useRef(false)
  const refresh = useCallback(() => {
    if (!enabled || pending.current) return
    pending.current = true
    const version = ++generation.current
    setLoading(true)
    void loadCurrentAiUsage().then(next => {
      if (generation.current === version) { setData(next); setError(null) }
    }).catch(() => { if (generation.current === version) setError("Unable to refresh usage.") })
      .finally(() => { if (generation.current === version) { pending.current = false; setLoading(false) } })
  }, [enabled])
  useEffect(() => {
    generation.current += 1; pending.current = false; setData(null); setError(null)
    refresh()
    window.addEventListener("focus", refresh)
    return () => { generation.current += 1; pending.current = false; window.removeEventListener("focus", refresh) }
  }, [refresh, scope])
  return <UsageContext.Provider value={enabled ? { data, error, loading, refresh, quote, setQuote, manageRequest, openManage } : null}>{children}</UsageContext.Provider>
}

/** Moves the current request estimate to usage without changing authorization. */
export function useAiUsageRequest(quote: Quote | null, status?: string) {
  const usage = useAiUsage(), owner = useId()
  const setQuote = usage?.setQuote, refresh = usage?.refresh
  const organizationId = quote?.organizationId, maximumCredits = quote?.maximumCredits, provider = quote?.provider, model = quote?.model
  useEffect(() => {
    if (!setQuote || !organizationId || maximumCredits === undefined) return
    setQuote({ owner, organizationId, maximumCredits, provider, model })
    return () => setQuote(previous => previous?.owner === owner ? null : previous)
  }, [setQuote, owner, organizationId, maximumCredits, provider, model])
  useEffect(() => { if (status) refresh?.() }, [status, refresh])
  return usage !== null
}
