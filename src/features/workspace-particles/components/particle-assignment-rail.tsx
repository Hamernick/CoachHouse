"use client"

import { ParticleButton as Button } from "@/components/ui/particle-ui"

import { useContext, useEffect, useState } from "react"
import UsersIcon from "lucide-react/dist/esm/icons/users"

import { ParticleAvatar } from "@/components/ui/particle-ui"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ParticleSelect } from "@/components/ui/particle-ui"
import { EMPTY_RESPONSIBILITY, supportsParticleResponsibility } from "../lib/particle-responsibility"
import type { MembershipResponsibility } from "../lib/particle-membership-responsibility"
import { ParticleResponsibilityPeople, ParticleResponsibilitySelector } from "./particle-responsibility-fields"
import type { ParticleNodeData } from "./particle-node"

type Scope = { key: string; label: string; revision: number; value: typeof EMPTY_RESPONSIBILITY; editable: boolean; membership?: MembershipResponsibility }
/** One entry per placement; shared work always names its exact plan context. */
export function ParticleAssignmentRail({ data }: { data: ParticleNodeData }) {
  const { particle, assignment } = data
  const people = useContext(ParticleResponsibilityPeople)
  const scopes: Scope[] = supportsParticleResponsibility(particle) && particle.type === "objective"
    ? [{ key: particle.id, label: particle.title, revision: particle.revision, value: particle.responsibility ?? EMPTY_RESPONSIBILITY, editable: true }]
    : (data.memberships ?? []).map(item => ({ ...item, membership: item }))
  const [choice, setChoice] = useState<{ key: string; walkthrough?: string }>()
  const [open, setOpen] = useState(false)
  const [snapshot, setSnapshot] = useState<Scope | undefined>()
  const [draft, setDraft] = useState(EMPTY_RESPONSIBILITY)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const selectedKey = open ? snapshot?.key : scopes.find(item => item.key === choice?.key && choice.walkthrough === data.assignmentContext)?.key ?? scopes.find(item => item.key === data.assignmentContext)?.key ?? (scopes.length === 1 ? scopes[0].key : undefined)
  const current = scopes.find(item => item.key === selectedKey)
  const value = current?.value ?? EMPTY_RESPONSIBILITY
  const dirty = open && Boolean(snapshot) && JSON.stringify(draft) !== JSON.stringify(snapshot?.value)
  const stale = open && Boolean(snapshot) && (!current || snapshot?.revision !== current.revision)
  const changed = assignment?.onDirtyChange
  useEffect(() => {
    changed?.(particle.id, dirty || saving)
    return () => changed?.(particle.id, false)
  }, [changed, particle.id, dirty, saving])
  const name = (id: string) => people?.find(person => person.id === id)?.name ?? "Unavailable person"
  const owner = current ? (value.ownerId ? name(value.ownerId) : "Assign owner") : "Choose plan"
  const load = (scope?: Scope) => { setSnapshot(scope); setDraft(scope?.value ?? EMPTY_RESPONSIBILITY); setFailed(false) }
  if (!scopes.length && !open) return null
  return <div className="nodrag nopan nowheel flex h-[52px] min-w-0 items-start pt-2" data-particle-assignment-rail onDoubleClick={event => event.stopPropagation()}>
    <Popover open={open} onOpenChange={next => {
      if (saving || (!next && dirty)) return
      if (next) load(current)
      setOpen(next)
    }}>
      <PopoverTrigger asChild><Button color="secondary" size="lg" type="button" variant="ghost" className="h-7 min-w-0 max-w-full justify-start gap-2 rounded-md px-2 text-xs text-muted-foreground [@media(pointer:coarse)]:h-11" aria-label={`Responsibility for ${particle.title}`} title={current?.label}>
        <UsersIcon className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{owner}{data.memberships && current && <span className="opacity-75"> · {current.label}</span>}</span>
        <span className="flex shrink-0 items-center gap-1">
          {value.contributorIds.slice(0, 2).map(id => <span key={id} title={name(id)} role="img" aria-label={`Contributor: ${name(id)}`}><ParticleAvatar className="particle-ui" size={20} name={name(id) === "Unavailable person" ? "?" : name(id)} /></span>)}
          {value.contributorIds.length > 2 && <span aria-label={`${value.contributorIds.length - 2} more contributors`}>+{value.contributorIds.length - 2}</span>}
        </span>
      </Button></PopoverTrigger>
      <PopoverContent align="start" className="nodrag nopan nowheel w-72 space-y-3" onInteractOutside={event => { if (dirty || saving) event.preventDefault() }} onEscapeKeyDown={event => { if (dirty || saving) event.preventDefault() }}>
        <p className="text-sm font-medium">Responsibility</p>
        {data.memberships && scopes.length > 1 ? <ParticleSelect value={snapshot?.key ?? ""} disabled={dirty || saving} onChange={event => { const key = event.target.value;  setChoice({ key, walkthrough: data.assignmentContext }); load(scopes.find(item => item.key === key))  }} aria-label="Plan context" className="w-full min-w-0">
<option value="" disabled>Choose plan</option>{scopes.map(scope => <option key={scope.key} value={scope.key}>{scope.label}</option>)}</ParticleSelect> : <p className="text-xs text-muted-foreground">{snapshot?.label ?? current?.label ?? "Plan no longer available."}</p>}
        {snapshot && <>
          <ParticleResponsibilitySelector value={draft} disabled={!data.editable || !assignment || !current?.editable || saving || stale} onChange={setDraft} />
          {stale && <p role="status" className="text-xs">{current ? "Plan changed." : "Plan no longer available."} Your draft is kept.</p>}
          {failed && !stale && <p role="alert" className="text-xs">Not saved. Your draft is kept. Retry or reload from the workspace save notice.</p>}
        </>}
        <div className="flex justify-end gap-2">
          <Button color="secondary" variant="ghost" size="md" disabled={saving} onClick={() => setOpen(false)}>{dirty ? "Discard" : "Close"}</Button>
          {stale ? current && <Button color="primary" size="md" onClick={() => load(current)}>Load latest</Button> : assignment && snapshot && <Button color="primary" size="md" disabled={!data.editable || !current?.editable || saving || !dirty} onClick={async () => {
            setSaving(true); setFailed(false)
            try {
              const saved = snapshot.membership
                ? await assignment.saveMembership?.(particle.id, snapshot.membership, draft)
                : particle.type === "objective" && await assignment.save({ ...particle, responsibility: draft })
              if (saved) setOpen(false); else setFailed(true)
            } catch { setFailed(true) }
            finally { setSaving(false) }
          }}>{saving ? "Saving…" : "Save"}</Button>}
        </div>
      </PopoverContent>
    </Popover>
  </div>
}
