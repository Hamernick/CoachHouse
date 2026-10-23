"use client"

import { useId, useRef, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWorkspaceOpportunity } from "@/actions/workspace-opportunities"
import type { WorkspaceFinanceOpportunityInput } from "../types"

export function WorkspaceOpportunityForm({ organizationId, onCreated, onCancel }: {
  organizationId: string; onCreated: (item: WorkspaceFinanceOpportunityInput) => void; onCancel: () => void
}) {
  const prefix = useId()
  const [title, setTitle] = useState("")
  const [source, setSource] = useState("")
  const [deadline, setDeadline] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submission = useRef<{ key: string; id: string } | null>(null)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    const key = JSON.stringify([organizationId, title.trim(), source.trim(), deadline])
    if (submission.current?.key !== key) submission.current = { key, id: crypto.randomUUID() }
    setPending(true)
    setError(null)
    try {
      const result = await createWorkspaceOpportunity({ id: submission.current.id, organizationId, title, source, deadline })
      if ("error" in result) setError(result.error)
      else onCreated(result.opportunity)
    } catch { setError("Unable to add this opportunity. Your entries are still here.") }
    finally { setPending(false) }
  }
  return <form aria-label="Add opportunity" onSubmit={submit} className="space-y-3 rounded-2xl border border-border/60 bg-background p-3" aria-busy={pending}>
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium">Add opportunity</h3><Button type="button" size="icon" variant="ghost" className="size-8 rounded-full" aria-label="Cancel adding opportunity" disabled={pending} onClick={onCancel}><X className="size-4" aria-hidden="true" /></Button></div>
    <fieldset disabled={pending} className="space-y-3">
      <div className="space-y-1.5"><Label htmlFor={`${prefix}-title`}>Title</Label><Input autoFocus id={`${prefix}-title`} value={title} onChange={event => setTitle(event.target.value)} required maxLength={200} placeholder="What’s the opportunity?" className="shadow-none" /></div>
      <div className="space-y-1.5"><Label htmlFor={`${prefix}-source`}>Source <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id={`${prefix}-source`} value={source} onChange={event => setSource(event.target.value)} maxLength={120} placeholder="Organization or provider" className="shadow-none" /></div>
      <div className="space-y-1.5"><Label htmlFor={`${prefix}-deadline`}>Deadline <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id={`${prefix}-deadline`} type="date" value={deadline} onChange={event => setDeadline(event.target.value)} className="shadow-none" /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full rounded-full" disabled={!title.trim()}>{pending ? "Adding…" : "Add opportunity"}</Button>
    </fieldset>
  </form>
}
