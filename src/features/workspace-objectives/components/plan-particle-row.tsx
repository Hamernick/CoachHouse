"use client"
import { useState, type ReactNode } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useReducedMotion } from "motion/react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HoverRevealText } from "@/components/ui/hover-reveal-text"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { PARTICLE_DRAG_MIME, isParticleWork, getParticleCapabilities, type Particle, type PlanBranchState } from "@/features/workspace-particles/client"
import { ParticleStatusMark, ParticleStatusLabel } from "./particle-status"
import { ObjectiveStatusMenu } from "./objective-status-menu"
import { ObjectiveInlineTitle } from "./objective-inline-title"
import type { PlanningControls } from "../hooks/use-particle-plans"
import styles from "./particle-objectives.module.css"

export function PlanParticleRow({ particle, controls, canOrganize, onRemove, onMove, onDrop, first, last, branchLabel, branchState, conditions, onCondition, responsibility, optional, onOptional }: {
  optional?: boolean
  onOptional?: (optional: boolean) => void
  responsibility?: ReactNode
  conditions?: { source: string; outcome: string; label: string; selected: boolean }[]
  onCondition?: (source: string, outcome: string, selected: boolean) => void
  branchLabel?: string; branchState?: PlanBranchState
  particle: Particle; controls: PlanningControls; canOrganize: boolean; first: boolean; last: boolean
  onRemove: () => void; onMove: (direction: -1 | 1) => void; onDrop: (raw: string) => void
}) {
  const [rename, setRename] = useState(false)
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
      {rename ? <ObjectiveInlineTitle initial={particle.title} pending={controls.pending} onCancel={() => setRename(false)} onSave={title => controls.edit({ ...particle, title })} /> : <Button
        ref={sortable.setActivatorNodeRef} {...(canDrag ? sortable.attributes : {})} {...sortable.listeners}
        title={particle.title} variant="ghost" className={`${styles.memberButton} touch-manipulation select-none ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} h-auto min-h-10 min-w-0 flex-1 justify-start gap-2 whitespace-normal rounded-xl px-2 text-left [@media(pointer:coarse)]:min-h-11`}
        aria-pressed={sortable.isDragging || selected}
        onClick={() => { if (!sortable.isDragging) controls.focusCanvas(particle.id) }}>
        <ParticleStatusMark particle={particle} /><span className="min-w-0 flex-1 overflow-hidden"><HoverRevealText label={particle.title} />{optional && <span className="block text-xs font-normal text-muted-foreground">Optional</span>}{branchLabel && <span className="block text-xs font-normal text-muted-foreground">If {branchLabel}</span>}</span>{branchState && branchState !== "active" ? <span data-branch-state-label className="shrink-0 pl-2 text-xs font-normal text-muted-foreground">{branchState === "waiting" ? "Needs decision" : "Not selected"}</span> : <ParticleStatusLabel particle={particle} visuallyHidden />}
      </Button>}
      {controls.canEdit && !controls.error && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7 shrink-0 rounded-md [@media(pointer:coarse)]:size-11" disabled={controls.pending} aria-label={`Options for ${particle.title}`}><MoreHorizontal aria-hidden /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {workspaceNote && <DropdownMenuItem onSelect={() => controls.select(particle.id)}>{shared ? "Edit shared note…" : "Edit note…"}</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => setRename(true)}>{shared ? "Rename everywhere…" : "Rename"}</DropdownMenuItem>
          {isParticleWork(particle) && !("source" in particle.data && particle.data.source) && <ObjectiveStatusMenu value={particle.status} completionLabel="Done" disabled={controls.pending || particle.locked} onChange={status => void controls.edit({ ...particle, status })} />}
          {canOrganize && onOptional && <DropdownMenuCheckboxItem checked={!optional} onCheckedChange={required => onOptional(!required)}>Required work</DropdownMenuCheckboxItem>}
          {canOrganize && Boolean(conditions?.length) && <DropdownMenuSub><DropdownMenuSubTrigger>Branch</DropdownMenuSubTrigger><DropdownMenuSubContent className="max-h-64 overflow-y-auto">{conditions?.map(condition=><DropdownMenuCheckboxItem key={`${condition.source}:${condition.outcome}`} checked={condition.selected} onCheckedChange={selected=>onCondition?.(condition.source,condition.outcome,selected)}>{condition.label}</DropdownMenuCheckboxItem>)}</DropdownMenuSubContent></DropdownMenuSub>}
          {canOrganize && <><DropdownMenuItem disabled={first} onSelect={() => onMove(-1)}>Move up</DropdownMenuItem><DropdownMenuItem disabled={last} onSelect={() => onMove(1)}>Move down</DropdownMenuItem><DropdownMenuItem onSelect={onRemove}>Remove from plan</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>}
    </div>
    {responsibility && <div className="pl-7">{responsibility}</div>}
  </li>
}
