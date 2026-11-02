"use client"

import { ParticleButton, ParticleInput } from "@/components/ui/particle-ui"

import { useId, useState } from "react"
import { Check, X } from "lucide-react"


export function ObjectiveInlineTitle({ initial, pending, onSave, onCancel }: {
  initial: string; pending: boolean; onSave: (title: string) => Promise<boolean>; onCancel: () => void
}) {
  const errorId = useId()
  const [title, setTitle] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = pending || saving
  return <form className="particle-ui min-w-0 flex-1" onSubmit={async event => {
    event.preventDefault()
    if (busy || !title.trim()) return
    setSaving(true); setError(null)
    try { if (await onSave(title.trim())) onCancel(); else setError("Unable to save. Your title is still here.") }
    catch { setError("Unable to save. Try again.") }
    finally { setSaving(false) }
  }} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!busy) onCancel() }
  }}>
    <div className="flex min-w-0 items-center gap-1">
      <ParticleInput autoFocus autoSelect aria-label="Plan title" placeholder="Name" value={title} required maxLength={240}
        size="2xl" disabled={busy} invalid={Boolean(error)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={event => setTitle(event.target.value)} className="min-w-0 flex-1" />
      <ParticleButton type="submit" color="secondary" variant="ghost" size="2xl" uniform pill={false}
        disabled={busy || !title.trim()} loading={saving} aria-label="Save title"><Check aria-hidden /></ParticleButton>
      <ParticleButton type="button" color="secondary" variant="ghost" size="2xl" uniform pill={false}
        disabled={busy} onClick={onCancel} aria-label="Cancel title edit"><X aria-hidden /></ParticleButton>
    </div>
    {error && <p id={errorId} role="alert" className="text-xs text-destructive">{error}</p>}
  </form>
}
