"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { startCreditPurchase } from "../purchase-actions"
import type { AiCreditPurchases } from "../purchase-types"

function price(amount: number, currency: string) {
  const format = new Intl.NumberFormat(undefined, { style: "currency", currency })
  return format.format(amount / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2))
}
export function CreditPurchaseControl({ organizationId, purchases }: { organizationId: string; purchases: AiCreditPurchases }) {
  const [selected, setSelected] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<{ id: string; pack: string } | null>(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (purchases.orders.some(order => order.id === request.current?.id && order.status !== "pending")) request.current = null
  }, [purchases.orders])
  if (!purchases.canPurchase) return null
  const pack = purchases.packs.find(item => item.key === selected) ?? purchases.packs[0]
  async function buy() {
    if (!pack || busy) return
    const popup = window.open("about:blank", "_blank")
    if (!popup) { setError("Allow a new tab to open secure checkout."); return }
    popup.opener = null
    setBusy(true); setError(null)
    if (!request.current || request.current.pack !== pack.key) request.current = { id: crypto.randomUUID(), pack: pack.key }
    try {
      const result = await startCreditPurchase({ organizationId, ...request.current })
      if (!mounted.current) { popup.close(); return }
      request.current = { id: result.orderId, pack: pack.key }
      popup.location.replace(result.url)
    } catch (cause) {
      popup.close()
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Checkout is unavailable. Retry this purchase.")
    } finally { if (mounted.current) setBusy(false) }
  }
  return <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
    {pack ? <div className="flex items-center gap-2">
      <Select value={pack.key} onValueChange={setSelected} disabled={busy}>
        <SelectTrigger aria-label="Credit pack" className="min-w-0 flex-1 rounded-full shadow-none"><SelectValue /></SelectTrigger>
        <SelectContent>{purchases.packs.map(item => <SelectItem key={item.key} value={item.key}>{item.credits.toLocaleString()} credits · {price(item.amount, item.currency)}</SelectItem>)}</SelectContent>
      </Select>
      <Button variant="secondary" className="shrink-0 rounded-full shadow-none" disabled={busy} onClick={() => void buy()}>{busy ? "Opening…" : "Buy credits"}</Button>
    </div> : null}
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    {purchases.orders.length ? <ul aria-label="Credit purchases" className="flex max-h-32 flex-col gap-2 overflow-auto text-xs text-muted-foreground">
      {purchases.orders.map(order => <li key={order.id} className="flex justify-between gap-3">
        <span>{order.credits.toLocaleString()} credits · {price(order.amount, order.currency)}</span>
        <span>{order.status === "paid" ? "Credited" : order.status === "pending" ? "Awaiting payment confirmation" : "Checkout expired"}</span>
      </li>)}
    </ul> : null}
  </div>
}
