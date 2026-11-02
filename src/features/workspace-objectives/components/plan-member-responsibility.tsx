"use client"

import { ParticleButton as Button } from "@/components/ui/particle-ui"

import { useContext, useState } from "react"
import UsersIcon from "lucide-react/dist/esm/icons/users"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ParticleResponsibilityPeople, ParticleResponsibilitySelector, EMPTY_RESPONSIBILITY, type ParticleResponsibility } from "@/features/workspace-particles/client"

/** This control edits one explicit membership, never the shared work record. */
export function PlanMemberResponsibility({ title, planTitle, value = EMPTY_RESPONSIBILITY, revision, disabled, editable, onSave }: {
  title: string
  planTitle: string
  value?: ParticleResponsibility
  revision: number
  disabled: boolean
  editable: boolean
  onSave: (value: ParticleResponsibility) => Promise<boolean>
}) {
  const people = useContext(ParticleResponsibilityPeople)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [baseRevision, setBaseRevision] = useState(revision)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const stale = baseRevision !== revision
  const dirty = JSON.stringify(draft) !== JSON.stringify(value)
  const name = value.ownerId ? people?.find(person => person.id === value.ownerId)?.name ?? "Unavailable person" : "Assign"
  return <Popover open={open} onOpenChange={next => {
    if (saving) return
    if (next) { setDraft(value); setBaseRevision(revision); setFailed(false) }
    setOpen(next)
  }}>
    <PopoverTrigger asChild><Button color="secondary" size="lg" type="button" variant="ghost" disabled={disabled && !open} className="h-auto min-h-7 max-w-full justify-start gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground [@media(pointer:coarse)]:min-h-11" aria-label={`Responsibility for ${title} in ${planTitle}`}>
      <UsersIcon className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{name}</span>{value.contributorIds.length > 0 && <span>+{value.contributorIds.length}</span>}
    </Button></PopoverTrigger>
    <PopoverContent align="start" className="nodrag nopan nowheel w-72 space-y-3" onInteractOutside={event => { if (dirty || saving) event.preventDefault() }} onEscapeKeyDown={event => { if (dirty || saving) event.preventDefault() }}>
      <p className="text-sm font-medium">Responsibility</p>
      <p className="text-xs text-muted-foreground">Only in {planTitle}.</p>
      <ParticleResponsibilitySelector value={draft} onChange={setDraft} disabled={!editable || disabled || saving || stale} />
      {stale && <p role="status" className="text-xs">Plan changed. Your draft is kept. Load the latest plan to continue.</p>}
      {failed && !stale && <p role="alert" className="text-xs">Not saved. Your draft is kept.</p>}
      <div className="flex justify-end gap-2">
        <Button color="secondary" variant="ghost" size="md" disabled={saving} onClick={() => setOpen(false)}>{dirty ? "Discard" : "Close"}</Button>
        {stale ? <Button color="primary" size="md" onClick={() => { setDraft(value); setBaseRevision(revision); setFailed(false) }}>Load latest</Button> : editable && <Button color="primary" size="md" disabled={disabled || saving || !dirty} onClick={async () => {
          setSaving(true); setFailed(false)
          try { if (await onSave(draft)) setOpen(false); else setFailed(true) }
          catch { setFailed(true) }
          finally { setSaving(false) }
        }}>{saving ? "Saving…" : "Save"}</Button>}
      </div>
    </PopoverContent>
  </Popover>
}
