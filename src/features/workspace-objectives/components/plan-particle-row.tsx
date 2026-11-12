"use client"

import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { useRef, useState, type ComponentProps } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useReducedMotion } from "motion/react"
import { MoreHorizontal } from "lucide-react"

import { ParticleMenu } from "@/components/ui/particle-ui"
import { PARTICLE_DRAG_MIME, isParticleWork, getParticleCapabilities, type Particle, type PlanBranchState } from "@/features/workspace-particles/client"
import { ParticleStatusMark, ParticleStatusLabel } from "./particle-status"
import { PlanMemberResponsibility } from "./plan-member-responsibility"
import { ObjectiveStatusMenu } from "./objective-status-menu"
import { ObjectiveInlineTitle } from "./objective-inline-title"
import type { PlanningControls } from "../hooks/use-particle-plans"
import styles from "./particle-objectives.module.css"

export function PlanParticleRow({ particle, controls, canOrganize, onRemove, onMove, onDrop, first, last, branchLabel, branchState, conditions, onCondition, responsibility, optional, onOptional }: {
  optional?: boolean
  onOptional?: (optional: boolean) => void
  responsibility?: Omit<ComponentProps<typeof PlanMemberResponsibility>, "anchorRef" | "onClose">
  conditions?: { source: string; outcome: string; label: string; selected: boolean }[]
  onCondition?: (source: string, outcome: string, selected: boolean) => void
  branchLabel?: string; branchState?: PlanBranchState
  particle: Particle; controls: PlanningControls; canOrganize: boolean; first: boolean; last: boolean
  onRemove: () => void; onMove: (direction: -1 | 1) => void; onDrop: (raw: string) => void
}) {
  const [rename, setRename] = useState(false)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const optionsRef = useRef<HTMLButtonElement>(null)
  const canEdit = controls.canEdit && !controls.error
  const workspaceNote = getParticleCapabilities(particle).some(capability => capability.action === "edit_note")
  const shared = (controls.graph?.particles.flatMap(item => item.type === "objective" ? item.data.planning?.plans ?? [] : [])
    .filter(plan => plan.particleIds.includes(particle.id)).length ?? 0) > 1
  const selected = (controls.canvasSelectedId ?? controls.selectedId) === particle.id
  const canDrag = canOrganize && !controls.pending
  const reducedMotion = useReducedMotion()
  const sortable = useSortable({ id: particle.id, disabled: !canDrag || rename, transition: reducedMotion ? null : { duration: 150, easing: "ease" } })
  return <li ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.35 : 1 }} className={styles.member} data-plan-member={particle.id} data-selected={selected} data-branch-state={branchState} onDragOver={event => { if (canDrag && event.dataTransfer.types.includes(PARTICLE_DRAG_MIME)) event.preventDefault() }}
    onDrop={event => { event.preventDefault(); event.stopPropagation(); if (canDrag) onDrop(event.dataTransfer.getData(PARTICLE_DRAG_MIME)) }}>
    <div className={styles.memberRow}>
      {rename ? <ObjectiveInlineTitle initial={particle.title} pending={controls.pending} onCancel={() => setRename(false)} onSave={title => controls.edit({ ...particle, title })} /> : <Button color="secondary" size="md"
        ref={sortable.setActivatorNodeRef} {...(canDrag ? sortable.attributes : {})} {...sortable.listeners}
        title={particle.title} variant="ghost" className={`${styles.memberButton} touch-manipulation select-none ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} h-auto min-h-10 min-w-0 flex-1 justify-start gap-2 whitespace-normal rounded-xl px-2 text-left [@media(pointer:coarse)]:min-h-11`}
        aria-pressed={sortable.isDragging || selected}
        onClick={() => { if (!sortable.isDragging) controls.focusCanvas(particle.id) }}>
        <ParticleStatusMark particle={particle} />
        <span className="min-w-0 text-left">
          <span data-plan-member-title className="block break-words leading-5">{particle.title}</span>
          {(optional || (branchState && branchState !== "active")) && <span className="flex flex-wrap gap-x-2 text-xs font-normal text-muted-foreground">
            {optional && <span>Optional</span>}
            {branchState && branchState !== "active" && <span data-branch-state-label>{branchState === "waiting" ? "Needs decision" : "Not selected"}</span>}
          </span>}
          {branchLabel && <span className="block break-words text-xs font-normal text-muted-foreground">If {branchLabel}</span>}
        </span>
        <ParticleStatusLabel particle={particle} visuallyHidden />
      </Button>}
      {(canEdit || responsibility) && <ParticleMenu modal><ParticleMenu.Trigger ><Button ref={optionsRef} color="secondary" uniform variant="ghost" size="sm" className="size-7 shrink-0 rounded-md [@media(pointer:coarse)]:size-11" disabled={controls.pending} aria-label={`Options for ${particle.title}`}><MoreHorizontal aria-hidden data-no-autosize className="size-3.5" /></Button></ParticleMenu.Trigger>
        <ParticleMenu.Content minWidth={0} width={224} align="end">
          {responsibility && <ParticleMenu.Item disabled={responsibility.disabled} onSelect={() => setAssignmentOpen(true)}>{responsibility.editable ? "Assign people…" : "View responsibility"}</ParticleMenu.Item>}
          {canEdit && <>
          {workspaceNote && <ParticleMenu.Item onSelect={() => controls.select(particle.id)}>{shared ? "Edit shared note…" : "Edit note…"}</ParticleMenu.Item>}
          <ParticleMenu.Item onSelect={() => setRename(true)}>{shared ? "Rename everywhere…" : "Rename"}</ParticleMenu.Item>
          {isParticleWork(particle) && !("source" in particle.data && particle.data.source) && <ObjectiveStatusMenu value={particle.status} completionLabel="Done" disabled={controls.pending || particle.locked} onChange={status => void controls.edit({ ...particle, status })} />}
          {canOrganize && onOptional && <ParticleMenu.CheckboxItem checked={!optional} onCheckedChange={required => onOptional(!required)}>Required work</ParticleMenu.CheckboxItem>}
          {canOrganize && Boolean(conditions?.length) && <ParticleMenu.Sub><ParticleMenu.SubTrigger>Branch</ParticleMenu.SubTrigger><ParticleMenu.SubContent minWidth={0} width={224} maxHeight={256}>{conditions?.map(condition=><ParticleMenu.CheckboxItem key={`${condition.source}:${condition.outcome}`} checked={condition.selected} onCheckedChange={selected=>onCondition?.(condition.source,condition.outcome,selected)}>{condition.label}</ParticleMenu.CheckboxItem>)}</ParticleMenu.SubContent></ParticleMenu.Sub>}
          {canOrganize && <><ParticleMenu.Item disabled={first} onSelect={() => onMove(-1)}>Move up</ParticleMenu.Item><ParticleMenu.Item disabled={last} onSelect={() => onMove(1)}>Move down</ParticleMenu.Item><ParticleMenu.Item onSelect={onRemove}>Remove from plan</ParticleMenu.Item></>}
          </>}
        </ParticleMenu.Content>
      </ParticleMenu>}
    </div>
    {assignmentOpen && responsibility && <PlanMemberResponsibility {...responsibility} anchorRef={optionsRef} onClose={() => setAssignmentOpen(false)} />}
  </li>
}
