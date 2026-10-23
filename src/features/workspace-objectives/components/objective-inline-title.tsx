"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

export function ObjectiveInlineTitle({ initial, pending, onSave, onCancel }: {
  initial: string; pending: boolean; onSave: (title: string) => Promise<boolean>; onCancel: () => void
}) {
  const [title, setTitle] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = pending || saving
  return <form className="min-w-0 flex-1" onSubmit={async event => {
    event.preventDefault()
    if (busy || !title.trim()) return
    setSaving(true); setError(null)
    try { if (await onSave(title.trim())) onCancel() }
    catch { setError("Unable to save. Try again.") }
    finally { setSaving(false) }
  }} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!busy) onCancel() }
  }}>
    <InputGroup className="items-center gap-0 rounded-xl border border-border/70 p-0.5">
      <InputGroupInput autoFocus aria-label="Plan title" placeholder="Name" value={title} required maxLength={240}
        disabled={busy} onChange={event => setTitle(event.target.value)} className="h-8 min-w-0 border-0 bg-transparent shadow-none dark:bg-transparent focus-visible:ring-0" />
      <InputGroupAddon className="gap-0">
        <Button type="submit" variant="ghost" size="icon" className="size-8 rounded-full" disabled={busy || !title.trim()} aria-label="Save title"><Check aria-hidden /></Button>
        <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" disabled={busy} onClick={onCancel} aria-label="Cancel title edit"><X aria-hidden /></Button>
      </InputGroupAddon>
    </InputGroup>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </form>
}
