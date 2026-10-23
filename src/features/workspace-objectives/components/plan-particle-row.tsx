"use client"
import { useState } from "react"
import { Circle, CircleCheck, CircleMinus, CircleDot, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { PARTICLE_DRAG_MIME, type Particle } from "@/features/workspace-particles/client"
import { ObjectiveInlineTitle } from "./objective-inline-title"
import type { PlanningControls } from "../hooks/use-particle-plans"
import styles from "./particle-objectives.module.css"

export function ParticleStatusMark({ status }: { status: Particle["status"] }) {
  const Icon = status === "done" ? CircleCheck : status === "blocked" ? CircleMinus : status === "in_progress" ? CircleDot : Circle
  return <Icon aria-label={status === "backlog" ? "Not started" : status === "in_progress" ? "In progress" : status === "done" ? "Complete" : "Blocked"} className={`size-4 shrink-0 ${status === "done" ? "text-emerald-600 dark:text-emerald-400" : status === "in_progress" ? "text-orange-600 dark:text-orange-400" : status === "blocked" ? "text-destructive" : "text-muted-foreground"}`} />
}
export function PlanParticleRow({ particle, controls, canOrganize, onRemove, onMove, onDrop, first, last }: {
  particle: Particle; controls: PlanningControls; canOrganize: boolean; first: boolean; last: boolean
  onRemove: () => void; onMove: (direction: -1 | 1) => void; onDrop: (raw: string) => void
}) {
  const [rename, setRename] = useState(false)
  const selected = controls.selectedId === particle.id
  return <li className={styles.member} onDragOver={event => { if (canOrganize && event.dataTransfer.types.includes(PARTICLE_DRAG_MIME)) event.preventDefault() }}
    onDrop={event => { event.preventDefault(); event.stopPropagation(); if (canOrganize) onDrop(event.dataTransfer.getData(PARTICLE_DRAG_MIME)) }}>
    <div className={`flex min-h-10 min-w-0 items-center gap-1 rounded-xl ${selected ? "bg-muted" : ""}`}>
      {rename ? <ObjectiveInlineTitle initial={particle.title} pending={controls.pending} onCancel={() => setRename(false)} onSave={title => controls.edit({ ...particle, title })} /> : <Button
        variant="ghost" className="h-auto min-h-10 min-w-0 flex-1 justify-start gap-2 whitespace-normal rounded-xl px-2 text-left [@media(pointer:coarse)]:min-h-11"
        aria-pressed={selected} draggable={canOrganize && !controls.pending} onDragStart={event => { event.dataTransfer.setData(PARTICLE_DRAG_MIME, JSON.stringify({ kind: "particle", workspaceId: particle.workspaceId, id: particle.id })); event.dataTransfer.effectAllowed = "copyMove" }}
        onClick={() => { if (controls.select(particle.id) && !particle.canvasHidden) void controls.flow.current?.fitView({ nodes: [{ id: particle.id }], maxZoom: 1, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200 }) }}>
        <ParticleStatusMark status={particle.status} /><span className="min-w-0 break-words">{particle.title}</span>
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
