"use client"

import { ParticleButton as Button, ParticleAlertDialogCancel as AlertDialogCancel, ParticleAlertDialogAction as AlertDialogAction } from "@/components/ui/particle-ui"
import { useEffect, useRef, useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useReducedMotion } from "motion/react"
import { WorkspaceResearch } from "@/features/workspace-ai/client"
import { planFromProposal } from "@/features/workspace-particles/client"
import { MoreHorizontal, ChevronRight, Plus, Search, Pencil, Scan, Trash2 } from "lucide-react"

import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog"
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ParticleMenu } from "@/components/ui/particle-ui"
import type { Particle, ParticlePlan } from "@/features/workspace-particles/client"
import { planningOf, type ObjectiveParticle, type PlanningControls, type useParticlePlans } from "../hooks/use-particle-plans"
import { ObjectiveStatusMenu } from "./objective-status-menu"
import { ObjectiveInlineTitle } from "./objective-inline-title"
import { ParticleStatusMark, ParticleStatusLabel } from "./particle-status"
import { ParticlePlanBranch } from "./particle-plan-branch"
import { PlanParticlePicker } from "./plan-particle-picker"
import { PlanningDisclosure } from "./planning-disclosure"
import styles from "./particle-objectives.module.css"

export function ParticleObjectiveCard({ objective, controls, actions, userId }: {
  objective: ObjectiveParticle; controls: PlanningControls; actions: ReturnType<typeof useParticlePlans>; userId: string
}) {
  const [open, setOpen] = useState(false)
  const [rename, setRename] = useState(false)
  const [research, setResearch] = useState<{ plan?: ParticlePlan; revision: number } | null>(null)
  const [newPlan, setNewPlan] = useState(false)
  const menuTrigger = useRef<HTMLButtonElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const canDrag = controls.canEdit && !controls.pending && !controls.error && !rename
  const reducedMotion = useReducedMotion()
  const sortable = useSortable({ id: objective.id, disabled: !canDrag, transition: reducedMotion ? null : { duration: 150, easing: "ease" } })
  const planning = planningOf(objective)
  const hasBranches = planning.plans.length > 0 || planning.proposals.some(proposal => proposal.status === "pending")
  const selectedHere = controls.selectedId === objective.id || planning.plans.some(plan => plan.particleIds.includes(controls.selectedId ?? ""))
  useEffect(() => { if (selectedHere) setOpen(true) }, [selectedHere, controls.selectedId])
  const store = (plan: ParticlePlan, created?: Particle) => actions.owner ? actions.savePlan(objective, plan, created)
    : actions.update(objective, { ...planning, proposals: [...planning.proposals, {
      id: crypto.randomUUID(), planId: plan.id, baseRevision: null, title: plan.title, particleIds: plan.particleIds,
      authorId: userId, createdAt: new Date().toISOString(), status: "pending",
    }] }, created)
  const add = (particle: Particle, created = false) => store({ id: crypto.randomUUID(), title: "Plan", revision: 0, particleIds: [particle.id] }, created || particle.canvasHidden ? particle : undefined)
  return <Collapsible asChild open={open} onOpenChange={setOpen} className={styles.objective} data-selected={selectedHere} data-status={objective.status} data-has-branches={hasBranches}>
    <li ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.35 : 1 }}>
    <div className={`${styles.objectiveHeader} flex min-w-0 items-center gap-0`}>
      {rename ? <ObjectiveInlineTitle initial={objective.title} pending={controls.pending} onCancel={() => setRename(false)} onSave={title => controls.edit({ ...objective, title })} /> : <CollapsibleTrigger asChild><Button color="secondary" size="lg" ref={sortable.setActivatorNodeRef} {...(canDrag ? sortable.attributes : {})} {...sortable.listeners} onClick={event => { if (!sortable.isDragging && !objective.canvasHidden && !controls.focusCanvas(objective.id)) event.preventDefault() }} variant="ghost" className={`touch-manipulation select-none ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} h-auto min-h-9 min-w-0 flex-1 text-[13px] [@media(pointer:coarse)]:min-h-11 justify-start gap-2 whitespace-normal rounded-xl pl-2 pr-0 has-[>svg]:pl-2 has-[>svg]:pr-0 text-left`}><ParticleStatusMark particle={objective} particles={controls.graph?.particles} /><span className="min-w-0 flex-1 truncate" title={objective.title}>{objective.title}</span><ParticleStatusLabel particle={objective} particles={controls.graph?.particles} visuallyHidden /><ChevronRight aria-hidden className={`size-3.5 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`} /></Button></CollapsibleTrigger>}
      {controls.canEdit && !controls.error && <ParticleMenu modal><ParticleMenu.Trigger ><Button color="secondary" uniform ref={menuTrigger} size="lg" variant="ghost" className="size-7 shrink-0 rounded-md [@media(pointer:coarse)]:size-11" disabled={controls.pending} aria-label={`Options for ${objective.title}`}><MoreHorizontal aria-hidden /></Button></ParticleMenu.Trigger><ParticleMenu.Content align="end" minWidth={0} width={240}>
        <ParticleMenu.Item onSelect={() => { setNewPlan(true); setOpen(true) }}><Plus aria-hidden />New plan</ParticleMenu.Item>
        <ParticleMenu.Item onSelect={() => { setResearch({ revision: objective.revision }); setOpen(true) }}><Search aria-hidden />Research & develop</ParticleMenu.Item>
        <ParticleMenu.Separator />
        <ParticleMenu.Item onSelect={() => setRename(true)}><Pencil aria-hidden />Rename</ParticleMenu.Item>
        <ParticleMenu.Item onSelect={() => controls.select(objective.id)}><Scan aria-hidden />Open on canvas</ParticleMenu.Item>
        {actions.owner && <ObjectiveStatusMenu value={objective.status} disabled={controls.pending} onChange={status => void controls.edit({ ...objective, status })} />}
        {(actions.owner || (!planning.plans.length && !planning.proposals.length)) && <><ParticleMenu.Separator /><ParticleMenu.Item className="text-destructive" disabled={controls.pending} onSelect={() => { setDeleteError(null); setConfirmDelete(true) }}><Trash2 aria-hidden />Delete</ParticleMenu.Item></>}
      </ParticleMenu.Content></ParticleMenu>}
    </div>
    <PlanningDisclosure open={open}>
      {research && <WorkspaceResearch stale={objective.revision !== research.revision || Boolean(research.plan && planning.plans.find(plan=>plan.id===research.plan?.id)?.revision !== research.plan.revision)} userId={userId} target={{organizationId:objective.workspaceId,objectiveId:objective.id,revision:research.revision,...(research.plan ? {plan:{id:research.plan.id,revision:research.plan.revision}} : {})}} planContext={research.plan ? {title:research.plan.title,members:research.plan.particleIds.map(id=>({id,title:controls.graph?.particles.find(item=>item.id===id)?.title ?? "Existing item"}))} : undefined} onClose={()=>setResearch(null)} onProposal={async (result, draft)=>{
        const graph=controls.getCurrentGraph()
        if(!graph)return false
        const previous=new Set(graph.particles.map(item=>item.id))
        const saved=await controls.applyResearch(result.runId,objective.id,draft)
        const added=saved?.graph.particles.filter(item=>!previous.has(item.id)).map(item=>item.id)??[]
        if(saved&&added.length) void controls.layout.run(false,added)
        return Boolean(saved)
      }} />}
      <div className={styles.branch}>
        {(hasBranches || newPlan || (controls.canEdit && !controls.error)) && <h3 className={styles.planLabel}>Plan</h3>}
        {planning.plans.map(plan => <ParticlePlanBranch key={plan.id} objective={objective} plan={plan} controls={controls} actions={actions} userId={userId} onRevise={()=>{setResearch({plan,revision:objective.revision});setOpen(true)}} />)}
        {planning.proposals.filter(proposal => proposal.status === "pending").map(proposal => <ParticlePlanBranch key={proposal.id} objective={objective} plan={planFromProposal(proposal)} proposal={proposal} controls={controls} actions={actions} userId={userId} />)}
        {newPlan && <ObjectiveInlineTitle initial="" pending={controls.pending} onCancel={() => setNewPlan(false)} onSave={title => store({ id: crypto.randomUUID(), title, revision: 0, particleIds: [] })} />}
        {!planning.plans.length && !planning.proposals.some(item => item.status === "pending") && controls.canEdit && !controls.error && !newPlan && <PlanParticlePicker particles={controls.graph?.particles ?? []} excluded={[objective.id]} pending={controls.pending} onAdd={add} onCreate={preset => add(actions.create(objective, preset), true)} />}
      </div>
    </PlanningDisclosure>
    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent onCloseAutoFocus={event => {
        event.preventDefault()
        const target = menuTrigger.current?.isConnected ? menuTrigger.current : document.querySelector<HTMLInputElement>('[aria-label="New objective"]')
        target?.focus({ preventScroll: true })
      }}>
        <AlertDialogHeader><AlertDialogTitle>Delete objective?</AlertDialogTitle><AlertDialogDescription>“{objective.title}” and its plans will be deleted. Linked cards, documents, and files will be kept.{planning.proposals.length > 0 && " Deleting proposal history cannot be undone."}</AlertDialogDescription></AlertDialogHeader>
        {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={controls.pending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={controls.pending} className="bg-destructive text-white hover:bg-destructive/90" onClick={async event => {
          event.preventDefault()
          setDeleteError(null)
          if (await controls.deleteObjective(objective.id)) setConfirmDelete(false)
          else setDeleteError("Could not delete this objective. Resolve any unsaved changes or save error, then try again.")
        }}>Delete</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </li>
  </Collapsible>
}
