"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadAiCreditLimits, saveAiCreditLimit } from "../limit-actions"
import type { AiCreditLimits } from "../limit-types"

export function CreditSpendingLimits({ organizationId }: { organizationId: string }) {
  const [limits, setLimits] = useState<AiCreditLimits | null>(null)
  const [subject, setSubject] = useState("organization")
  const [value, setValue] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const request = useRef<{ signature: string; id: string } | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    void loadAiCreditLimits(organizationId).then(result => { if (mounted.current) setLimits(result) }).catch(() => { if (mounted.current) setError("Spending limits are unavailable.") })
    return () => { mounted.current = false }
  }, [organizationId])
  const selected = subject === "organization" ? limits?.organization : limits?.members.find(member => member.memberId === subject)
  useEffect(() => { setValue(selected?.limit?.toString() ?? "") }, [selected])
  async function reload() {
    setPending(true)
    try { const result = await loadAiCreditLimits(organizationId); if (mounted.current) { setLimits(result); setError(null) } }
    catch { if (mounted.current) setError("Spending limits are unavailable.") }
    finally { if (mounted.current) setPending(false) }
  }
  async function save() {
    if (!selected || pending) return
    const amount = value.trim() === "" ? null : Number(value)
    if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0 || amount > 100000000)) { setError("Enter a whole number from 0 to 100,000,000."); return }
    const signature = JSON.stringify([subject, amount, selected.revision])
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() }
    setPending(true); setError(null); setSaved(false)
    try {
      const result = await saveAiCreditLimit({ organizationId, memberId: subject === "organization" ? null : subject, limit: amount, revision: selected.revision, operationId: request.current.id })
      if (mounted.current) { setLimits(result); setSaved(true) }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Unable to save this limit.") }
    finally { if (mounted.current) setPending(false) }
  }
  if (!limits) return error ? <p role="status" className="text-xs text-muted-foreground">{error}</p> : null
  const own = limits.members[0]
  const summary = limits.canManage ? limits.organization : own
  const reset = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(limits.resetsAt))
  return <Collapsible className="flex flex-col gap-2 border-t border-border/60 pt-3">
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{summary?.used.toLocaleString() ?? 0}{summary?.limit != null ? ` / ${summary.limit.toLocaleString()}` : ""} credits this month</span>
      {limits.canManage ? <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="h-8 rounded-full px-2 text-xs">Spending limits</Button></CollapsibleTrigger> : null}
    </div>
    {limits.canManage ? <CollapsibleContent className="space-y-2">
      <Select value={subject} onValueChange={next => { setSubject(next); setError(null); setSaved(false) }} disabled={pending}>
        <SelectTrigger aria-label="Spending limit for" className="w-full rounded-full shadow-none"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="organization">Organization</SelectItem>{limits.members.map(member => <SelectItem key={member.memberId} value={member.memberId}>{member.name}</SelectItem>)}</SelectContent>
      </Select>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1"><div className="flex items-center justify-between gap-2"><Label htmlFor={`credit-limit-${organizationId}`} className="text-xs">Monthly credit limit</Label><span className="text-xs text-muted-foreground tabular-nums">{selected?.used.toLocaleString()} used</span></div>
          <Input id={`credit-limit-${organizationId}`} type="number" min={0} max={100000000} step={1} inputMode="numeric" value={value} onChange={event => { setValue(event.target.value); setSaved(false) }} placeholder="No added cap" disabled={pending} className="rounded-full shadow-none" /></div>
        <Button variant="secondary" className="shrink-0 rounded-full shadow-none" disabled={pending || value === (selected?.limit?.toString() ?? "")} onClick={() => void save()}>{pending ? "Saving…" : "Save limit"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">Blank: no added cap · 0: pause. Resets {reset}, 00:00 UTC.</p>
      {error ? <p role="alert" className="text-xs text-destructive">{error}{error.includes("Reload") ? <Button variant="link" size="sm" className="h-auto px-1 py-0 text-xs" onClick={() => void reload()} disabled={pending}>Reload limits</Button> : null}</p> : null}
      {saved ? <p role="status" className="text-xs text-muted-foreground">Limit saved. Current requests can finish.</p> : null}
    </CollapsibleContent> : <p className="text-xs text-muted-foreground">Resets {reset}, 00:00 UTC. Ask your organization owner to change limits.</p>}
  </Collapsible>
}
