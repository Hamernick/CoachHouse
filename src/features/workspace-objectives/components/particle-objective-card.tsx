"use client"
import { useEffect, useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useReducedMotion } from "motion/react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import type { Particle, ParticlePlan } from "@/features/workspace-particles/client"
import { planningOf, type ObjectiveParticle, type PlanningControls, type useParticlePlans } from "../hooks/use-particle-plans"
import { ObjectiveInlineTitle } from "./objective-inline-title"
import { ParticleStatusMark, ParticleStatusLabel } from "./particle-status"
import { ParticlePlanBranch } from "./particle-plan-branch"
import { PlanParticlePicker } from "./plan-particle-picker"
import styles from "./particle-objectives.module.css"

export function ParticleObjectiveCard({ objective, controls, actions, userId }: {
  objective: ObjectiveParticle; controls: PlanningControls; actions: ReturnType<typeof useParticlePlans>; userId: string
}) {
  const [open, setOpen] = useState(true)
  const [rename, setRename] = useState(false)
  const [newPlan, setNewPlan] = useState(false)
  const canDrag = controls.canEdit && !controls.pending && !controls.error && !rename
  const reducedMotion = useReducedMotion()
  const sortable = useSortable({ id: objective.id, disabled: !canDrag, transition: reducedMotion ? null : { duration: 150, easing: "ease" } })
  const planning = planningOf(objective)
  const selectedHere = controls.selectedId === objective.id || planning.plans.some(plan => plan.particleIds.includes(controls.selectedId ?? ""))
  useEffect(() => { if (selectedHere) setOpen(true) }, [selectedHere, controls.selectedId])
  const store = (plan: ParticlePlan, created?: Particle) => actions.owner ? actions.savePlan(objective, plan, created)
    : actions.update(objective, { ...planning, proposals: [...planning.proposals, {
      id: crypto.randomUUID(), planId: plan.id, baseRevision: null, title: plan.title, particleIds: plan.particleIds,
      authorId: userId, createdAt: new Date().toISOString(), status: "pending",
    }] }, created)
  const add = (particle: Particle, created = false) => store({ id: crypto.randomUUID(), title: "Plan", revision: 0, particleIds: [particle.id] }, created || particle.canvasHidden ? particle : undefined)
  return <Collapsible asChild open={open} onOpenChange={setOpen} className={styles.objective}>
    <li ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.35 : 1 }}>
    <div className={`${styles.objectiveHeader} flex min-w-0 items-center gap-1`}>
      {rename ? <ObjectiveInlineTitle initial={objective.title} pending={controls.pending} onCancel={() => setRename(false)} onSave={title => controls.edit({ ...objective, title })} /> : <CollapsibleTrigger asChild><Button ref={sortable.setActivatorNodeRef} {...(canDrag ? sortable.attributes : {})} {...sortable.listeners} variant="ghost" className={`touch-manipulation select-none ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} h-auto min-h-11 min-w-0 flex-1 justify-start gap-2 whitespace-normal rounded-xl px-2 text-left`}><ParticleStatusMark particle={objective} /><span className="min-w-0 flex-1 break-words">{objective.title}</span><ParticleStatusLabel particle={objective} /></Button></CollapsibleTrigger>}
      {controls.canEdit && !controls.error && <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-9 rounded-full [@media(pointer:coarse)]:size-11" disabled={controls.pending} aria-label={`Options for ${objective.title}`}><MoreHorizontal aria-hidden /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setRename(true)}>Rename</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { setNewPlan(true); setOpen(true) }}>New plan</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => controls.select(objective.id)}>Open on canvas</DropdownMenuItem>
        {actions.owner && <><DropdownMenuSeparator />{(["backlog", "in_progress", "blocked", "done"] as const).map((status, index) => <DropdownMenuItem key={status} onSelect={() => void controls.edit({ ...objective, status })}>{["Not started", "In progress", "Blocked", "Complete"][index]}</DropdownMenuItem>)}</>}
      </DropdownMenuContent></DropdownMenu>}
    </div>
    <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up motion-reduce:animate-none">
      <div className={styles.branch}>
        {planning.plans.map(plan => <ParticlePlanBranch key={plan.id} objective={objective} plan={plan} controls={controls} actions={actions} userId={userId} />)}
        {planning.proposals.filter(proposal => proposal.status === "pending").map(proposal => <ParticlePlanBranch key={proposal.id} objective={objective} plan={{ id: proposal.planId, title: proposal.title, particleIds: proposal.particleIds, revision: proposal.baseRevision ?? 0 }} proposal={proposal} controls={controls} actions={actions} userId={userId} />)}
        {newPlan && <ObjectiveInlineTitle initial="" pending={controls.pending} onCancel={() => setNewPlan(false)} onSave={title => store({ id: crypto.randomUUID(), title, revision: 0, particleIds: [] })} />}
        {!planning.plans.length && !planning.proposals.some(item => item.status === "pending") && controls.canEdit && !controls.error && !newPlan && <PlanParticlePicker particles={controls.graph?.particles ?? []} excluded={[objective.id]} pending={controls.pending} onAdd={add} onCreate={preset => add(actions.create(objective, preset), true)} />}
      </div>
    </CollapsibleContent>
    </li>
  </Collapsible>
}
