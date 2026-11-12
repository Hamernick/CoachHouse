"use client"

import { ParticleButton as Button } from "@/components/ui/particle-ui"

import { useRef, useState, type RefObject } from "react"

import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"
import { ParticleResponsibilitySelector, EMPTY_RESPONSIBILITY, type ParticleResponsibility } from "@/features/workspace-particles/client"

/** This control edits one explicit membership, never the shared work record. */
export function PlanMemberResponsibility({ title, planTitle, value = EMPTY_RESPONSIBILITY, revision, disabled, editable, onSave, anchorRef, onClose }: {
  anchorRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  title: string
  planTitle: string
  value?: ParticleResponsibility
  revision: number
  disabled: boolean
  editable: boolean
  onSave: (value: ParticleResponsibility) => Promise<boolean>
}) {
  const anchor = useRef({ getBoundingClientRect: () => anchorRef.current?.getBoundingClientRect() ?? new DOMRect() })
  const [draft, setDraft] = useState(value)
  const [baseRevision, setBaseRevision] = useState(revision)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const stale = baseRevision !== revision
  const dirty = JSON.stringify(draft) !== JSON.stringify(value)
  return <Popover open modal onOpenChange={next => { if (!next && !saving) onClose() }}>
    <PopoverAnchor virtualRef={anchor} />
    <PopoverContent align="end" aria-label={'Responsibility for ' + title + ' in ' + planTitle} className="nodrag nopan nowheel w-72 space-y-3"
      onCloseAutoFocus={event => { event.preventDefault(); anchorRef.current?.focus({ preventScroll: true }) }}
      onInteractOutside={event => { if (dirty || saving) event.preventDefault() }} onEscapeKeyDown={event => { if (dirty || saving) event.preventDefault() }}>
      <p className="text-sm font-medium">Responsibility</p>
      <p className="text-xs text-muted-foreground">Only in {planTitle}.</p>
      <ParticleResponsibilitySelector value={draft} onChange={setDraft} disabled={!editable || disabled || saving || stale} />
      {stale && <p role="status" className="text-xs">Plan changed. Your draft is kept. Load the latest plan to continue.</p>}
      {failed && !stale && <p role="alert" className="text-xs">Not saved. Your draft is kept.</p>}
      <div className="flex justify-end gap-2">
        <Button color="secondary" variant="ghost" size="md" disabled={saving} onClick={onClose}>{dirty ? "Discard" : "Close"}</Button>
        {stale ? <Button color="primary" size="md" onClick={() => { setDraft(value); setBaseRevision(revision); setFailed(false) }}>Load latest</Button> : editable && <Button color="primary" size="md" disabled={disabled || saving || !dirty} onClick={async () => {
          setSaving(true); setFailed(false)
          try { if (await onSave(draft)) onClose(); else setFailed(true) }
          catch { setFailed(true) }
          finally { setSaving(false) }
        }}>{saving ? "Saving…" : "Save"}</Button>}
      </div>
    </PopoverContent>
  </Popover>
}
