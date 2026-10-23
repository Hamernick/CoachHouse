"use client"
import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useReducedMotion } from "motion/react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { PARTICLE_DRAG_MIME, type Particle } from "@/features/workspace-particles/client"
import { ParticleStatusMark, ParticleStatusLabel } from "./particle-status"
import { ObjectiveInlineTitle } from "./objective-inline-title"
import type { PlanningControls } from "../hooks/use-particle-plans"
import styles from "./particle-objectives.module.css"

export function PlanParticleRow({ particle, controls, canOrganize, onRemove, onMove, onDrop, first, last }: {
  particle: Particle; controls: PlanningControls; canOrganize: boolean; first: boolean; last: boolean
  onRemove: () => void; onMove: (direction: -1 | 1) => void; onDrop: (raw: string) => void
}) {
  const [rename, setRename] = useState(false)
  const selected = controls.selectedId === particle.id
  const canDrag = canOrganize && !controls.pending
  const reducedMotion = useReducedMotion()
  const sortable = useSortable({ id: particle.id, disabled: !canDrag || rename, transition: reducedMotion ? null : { duration: 150, easing: "ease" } })
  return <li ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.35 : 1 }} className={styles.member} onDragOver={event => { if (canDrag && event.dataTransfer.types.includes(PARTICLE_DRAG_MIME)) event.preventDefault() }}
    onDrop={event => { event.preventDefault(); event.stopPropagation(); if (canDrag) onDrop(event.dataTransfer.getData(PARTICLE_DRAG_MIME)) }}>
    <div className={`flex min-h-10 min-w-0 items-center gap-1 rounded-xl ${selected ? "bg-muted" : ""}`}>
      {rename ? <ObjectiveInlineTitle initial={particle.title} pending={controls.pending} onCancel={() => setRename(false)} onSave={title => controls.edit({ ...particle, title })} /> : <Button
        ref={sortable.setActivatorNodeRef} {...(canDrag ? sortable.attributes : {})} {...sortable.listeners}
        variant="ghost" className={`touch-manipulation select-none ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} h-auto min-h-10 min-w-0 flex-1 justify-start gap-2 whitespace-normal rounded-xl px-2 text-left [@media(pointer:coarse)]:min-h-11`}
        aria-pressed={sortable.isDragging || selected}
        onClick={() => { if (controls.select(particle.id) && !particle.canvasHidden) void controls.flow.current?.fitView({ nodes: [{ id: particle.id }], maxZoom: 1, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200 }) }}>
        <ParticleStatusMark particle={particle} /><span className="min-w-0 flex-1 break-words">{particle.title}</span><ParticleStatusLabel particle={particle} />
      </Button>}
      {controls.canEdit && !controls.error && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-full [@media(pointer:coarse)]:size-11" disabled={controls.pending} aria-label={`Options for ${particle.title}`}><MoreHorizontal aria-hidden /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRename(true)}>Rename</DropdownMenuItem>
          {canOrganize && <><DropdownMenuItem disabled={first} onSelect={() => onMove(-1)}>Move up</DropdownMenuItem><DropdownMenuItem disabled={last} onSelect={() => onMove(1)}>Move down</DropdownMenuItem><DropdownMenuItem onSelect={onRemove}>Remove from plan</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>}
    </div>
  </li>
}
