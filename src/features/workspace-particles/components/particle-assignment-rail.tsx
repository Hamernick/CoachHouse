"use client"

import { useContext, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ParticleAssigneeAvatars } from "./particle-assignee-avatars"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ParticleSelect } from "@/components/ui/particle-ui"
import { EMPTY_RESPONSIBILITY, supportsParticleResponsibility } from "../lib/particle-responsibility"
import type { MembershipResponsibility } from "../lib/particle-membership-responsibility"
import { ParticleResponsibilityPeople, ParticleResponsibilitySelector } from "./particle-responsibility-fields"
import type { ParticleNodeData } from "./particle-node"

type Scope = { key: string; label: string; revision: number; value: typeof EMPTY_RESPONSIBILITY; editable: boolean; membership?: MembershipResponsibility }
type PendingAssignment = { scope: Scope; value: typeof EMPTY_RESPONSIBILITY; failed: boolean }
/** One entry per placement; every selection uses the existing revision-checked writer. */
export function ParticleAssignmentRail({ data }: { data: ParticleNodeData }) {
  const { particle, assignment } = data
  const people = useContext(ParticleResponsibilityPeople)
  const memberships = (data.memberships ?? []).map(item => ({ ...item, membership: item }))
  const scopes: Scope[] = [
    ...(supportsParticleResponsibility(particle) ? [{ key: particle.id, label: "This particle", revision: particle.revision, value: particle.responsibility ?? EMPTY_RESPONSIBILITY, editable: !particle.locked }] : []),
    ...memberships,
  ]
  const [choice, setChoice] = useState<{ key: string; walkthrough?: string }>()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<PendingAssignment>()
  const inFlight = useRef(false)
  const selectedKey = pending?.scope.key ?? scopes.find(item => item.key === choice?.key && choice.walkthrough === data.assignmentContext)?.key ?? scopes.find(item => item.key === data.assignmentContext)?.key ?? (memberships.length === 1 ? memberships[0].key : memberships.length === 0 ? particle.id : undefined)
  const current = scopes.find(item => item.key === selectedKey)
  const value = pending?.value ?? current?.value ?? EMPTY_RESPONSIBILITY
  const stale = Boolean(pending && (!current || pending.scope.revision !== current.revision))
  const saving = Boolean(pending && !pending.failed)
  const changed = assignment?.onDirtyChange
  useEffect(() => {
    changed?.(particle.id, Boolean(pending))
    return () => changed?.(particle.id, false)
  }, [changed, particle.id, pending])
  // The workspace save notice can also retry the same captured command.
  useEffect(() => {
    if (pending?.failed && current && current.revision !== pending.scope.revision && JSON.stringify(current.value) === JSON.stringify(pending.value)) setPending(undefined)
  }, [pending, current])
  const save = async (next: typeof EMPTY_RESPONSIBILITY, retry = false) => {
    if (inFlight.current || !assignment || (!retry && !data.editable) || !current?.editable || (pending && !retry)) return
    const scope = retry && pending ? pending.scope : current
    inFlight.current = true
    setPending({ scope, value: next, failed: false })
    try {
      const saved = retry ? await assignment.retry?.(particle.id, scope.membership, next) : scope.membership
        ? await assignment.saveMembership?.(particle.id, scope.membership, next)
        : await assignment.save({ ...particle, responsibility: next })
      setPending(saved ? undefined : { scope, value: next, failed: true })
    } catch { setPending({ scope, value: next, failed: true }) }
    finally { inFlight.current = false }
  }
  const savedValue = current?.value ?? EMPTY_RESPONSIBILITY
  const selectedIds = [...(savedValue.ownerId ? [savedValue.ownerId] : []), ...savedValue.contributorIds]
  const label = selectedIds.length ? "Assigned" : "Assign"
  if (!scopes.length && !pending && !open) return null
  return <div className="nodrag nopan nowheel flex h-[52px] min-w-0 items-start pt-2" data-particle-assignment-rail onDoubleClick={event => event.stopPropagation()}>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button type="button" variant="ghost" size="sm" className="border-border/65 bg-card hover:bg-muted/20 h-9 min-w-9 max-w-full gap-1.5 rounded-full border py-1 pl-1 pr-3 text-left font-normal transition-colors [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11" aria-label={`${label} people for ${particle.title}`} title={current?.membership ? current.label : label} aria-busy={saving}>
        <ParticleAssigneeAvatars ids={selectedIds} people={people} />
        <span className="min-w-0 truncate">{label}</span>
      </Button></PopoverTrigger>
      <PopoverContent align="start" className="nodrag nopan nowheel w-64 max-w-[calc(100vw-24px)] space-y-3 rounded-2xl p-3 text-left shadow-none">
        <p className="text-sm font-normal">Assign</p>
        {data.memberships && scopes.length > 1 && <ParticleSelect value={selectedKey ?? ""} disabled={Boolean(pending)} onChange={event => setChoice({ key: event.target.value, walkthrough: data.assignmentContext })} aria-label="Plan context" className="w-full min-w-0">
          <option value="" disabled>Choose plan</option>{scopes.map(scope => <option key={scope.key} value={scope.key}>{scope.label}</option>)}
        </ParticleSelect>}
        {(current || pending) && <ParticleResponsibilitySelector value={value} disabled={!data.editable || !assignment || !current?.editable || Boolean(pending)} onChange={next => void save(next)} />}
        {saving && <span role="status" className="sr-only">Saving assignment</span>}
        {pending?.failed && <div role="alert" className="flex items-center justify-between gap-2 text-xs">
          <span>{stale ? current ? "Assignment changed. Your selection is kept." : "Plan unavailable. Your selection is kept." : "Not saved. Your selection is kept."}</span>
          {stale ? <Button type="button" variant="ghost" size="sm" onClick={() => setPending(undefined)}>Load latest</Button>
            : assignment?.retry && <Button type="button" variant="ghost" size="sm" disabled={!current?.editable} onClick={() => void save(pending.value, true)}>Retry</Button>}
        </div>}
      </PopoverContent>
    </Popover>
  </div>
}
