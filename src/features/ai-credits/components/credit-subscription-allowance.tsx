"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { assignAiAllowance, loadAiAllowance } from "../allowance-actions"
import type { AiAllowanceSetup } from "../allowance-types"

export function CreditSubscriptionAllowance({ organizationId, onAssigned }: { organizationId: string; onAssigned: () => void }) {
  const [setup, setSetup] = useState<AiAllowanceSetup | null>(null)
  const [selected, setSelected] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  const mounted = useRef(true)
  const operation = useRef<{ subscription: string; id: string } | null>(null)
  useEffect(() => {
    mounted.current = true
    let disposed = false
    void loadAiAllowance(organizationId).then(result => { if (!disposed) { setSetup(result); setError(null) } })
      .catch(() => { if (!disposed) setError("Unable to load subscription allowance.") })
    return () => { disposed = true; mounted.current = false }
  }, [organizationId, retry])
  const chosen = setup?.options.find(option => option.id === selected) ?? setup?.options[0]
  async function assign() {
    if (!chosen || busy) return
    if (operation.current?.subscription !== chosen.id) operation.current = { subscription: chosen.id, id: crypto.randomUUID() }
    setBusy(true); setError(null)
    try {
      const result = await assignAiAllowance({ organizationId, subscriptionId: chosen.id, operationId: operation.current.id })
      if (mounted.current) { setSetup(result); onAssigned() }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Unable to assign allowance. Retry this request.") }
    finally { if (mounted.current) setBusy(false) }
  }
  if (!setup && !error) return null
  return <section aria-label="Subscription allowance" className="flex flex-col gap-2 border-t border-border/60 pt-3 text-xs">
    {setup?.grant ? <p>{setup.grant.label} · {setup.grant.credits.toLocaleString()} included credits/month</p> : chosen ? <>
      <p>Assign included credits to <strong>{setup?.organizationName}</strong>.</p>
      <div className="flex items-center gap-2">
        <Select value={chosen.id} onValueChange={setSelected} disabled={busy || Boolean(setup?.binding)}>
          <SelectTrigger aria-label="Subscription allowance" className="min-w-0 flex-1 rounded-full shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent>{setup?.options.map(option => <SelectItem key={option.id} value={option.id}>{option.label} · {option.credits.toLocaleString()}/month</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="secondary" size="sm" className="shrink-0 rounded-full shadow-none" disabled={busy} onClick={() => void assign()}>{busy ? "Confirming…" : setup?.binding ? "Confirm allowance" : "Assign"}</Button>
      </div>
    </> : setup?.binding ? <p className="text-muted-foreground">No current eligible allowance.</p> : null}
    {error ? <div className="flex items-center justify-between gap-2"><p role="alert" className="text-destructive">{error}</p>{!setup ? <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setRetry(value => value + 1)}>Retry</Button> : null}</div> : null}
  </section>
}
