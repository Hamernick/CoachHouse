"use client"

import { useEffect, useState } from "react"
import type { AiCreditAccount } from "../types"
import { aiCreditBalance } from "../lib"
import { loadCreditPurchases } from "../purchase-actions"
import type { AiCreditPurchases } from "../purchase-types"
import { CreditPurchaseControl } from "./credit-purchase-control"

export function AiCreditsPanel({ account, organizationId }: { account: AiCreditAccount; organizationId?: string }) {
  const [fresh, setFresh] = useState<{ account: AiCreditAccount; purchases: AiCreditPurchases } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setFresh(null); setError(null)
    if (!organizationId) return
    let disposed = false, loading = false, attempts = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    async function refresh() {
      if (loading) return
      loading = true
      try {
        const result = await loadCreditPurchases(organizationId!)
        if (!disposed) { setFresh(result); setError(null) }
        // Brief reconciliation after checkout return. Never infer payment from
        // focus/redirect, and never poll indefinitely or start another purchase.
        if (!disposed && result.purchases.orders.some(order => order.status === "pending") && attempts++ < 12) timer = setTimeout(refresh, 5000)
      } catch { if (!disposed) setError("Unable to update credit balance.") }
      finally { loading = false }
    }
    function onFocus() { clearTimeout(timer); attempts = 0; void refresh() }
    void refresh()
    window.addEventListener("focus", onFocus)
    return () => { disposed = true; clearTimeout(timer); window.removeEventListener("focus", onFocus) }
  }, [organizationId, account])
  const current = fresh?.account ?? account
  const balance = aiCreditBalance(current)
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p><strong className="tabular-nums">{balance.available.toLocaleString()}</strong> credits available</p>
      <dl className="grid grid-cols-2 gap-2 text-muted-foreground">
        <dt>Included</dt><dd className="text-right tabular-nums">{balance.included.toLocaleString()}</dd>
        <dt>Purchased</dt><dd className="text-right tabular-nums">{balance.purchased.toLocaleString()}</dd>
        <dt>Reserved</dt><dd className="text-right tabular-nums">{balance.reserved.toLocaleString()}</dd>
      </dl>
      {organizationId && fresh ? <CreditPurchaseControl key={organizationId} organizationId={organizationId} purchases={fresh.purchases} /> : null}
      {error ? <p role="status" className="text-xs text-muted-foreground">{error}</p> : null}
      {current.history.length ? <ul className="flex max-h-52 flex-col gap-2 overflow-auto" aria-label="Your AI usage">
        {current.history.map(run => <li key={run.id} className="flex justify-between gap-3 border-t border-border/60 pt-2 text-xs">
          <span>{new Date(run.created_at).toLocaleString()} · {run.status}</span>
          <span className="shrink-0 tabular-nums">{run.charged_credits === null ? `${run.max_credits} reserved` : `${run.charged_credits} credits`}</span>
        </li>)}
      </ul> : null}
    </div>
  )
}
