"use client"
import { useState } from "react"
import { toast } from "@/lib/toast"
import { MoreHorizontal, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { PARTICLE_DRAG_MIME, readParticleDrag, type ParticlePlan, type ParticlePlanProposal, type Particle } from "@/features/workspace-particles/client"
import { PlanParticlePicker } from "./plan-particle-picker"
import { PlanParticleRow } from "./plan-particle-row"
import { PlanParticleList } from "./plan-particle-list"
import { ObjectiveInlineTitle } from "./objective-inline-title"
import { planningOf, type ObjectiveParticle, type PlanningControls, type useParticlePlans } from "../hooks/use-particle-plans"
import styles from "./particle-objectives.module.css"

type Actions = ReturnType<typeof useParticlePlans>
export function ParticlePlanBranch({ objective, plan, proposal, controls, actions, userId }: {
  objective: ObjectiveParticle; plan: ParticlePlan; proposal?: ParticlePlanProposal; controls: PlanningControls; actions: Actions; userId: string
}) {
  const [rename, setRename] = useState(false)
  const [open, setOpen] = useState(true)
  const planning = planningOf(objective)
  const editable = controls.canEdit && !controls.error && (proposal ? actions.owner || proposal.authorId === userId : actions.owner)
  const save = (value: ParticlePlan, created?: Particle) => proposal
    ? actions.update(objective, { ...planning, proposals: planning.proposals.map(item => item.id === proposal.id ? { ...item, title: value.title, particleIds: value.particleIds, ...(value.links ? { links: value.links } : {}) } : item) }, created)
    : actions.savePlan(objective, value, created)
  const add = (particle: Particle) => save({ ...plan, particleIds: [...plan.particleIds.filter(id => id !== particle.id), particle.id] }, particle.canvasHidden ? particle : undefined)
  const remove = async (id: string) => {
    if (!await save({ ...plan, particleIds: plan.particleIds.filter(value => value !== id), links: plan.links?.filter(link=>link.source!==id && link.target!==id) })) return
    toast.success("Removed from plan", { action: { label: "Undo", onClick: () => {
      const graph = controls.getCurrentGraph()
      const current = graph?.particles.find(item => item.id === objective.id)
      if (current?.type !== "objective" || !graph?.particles.some(item => item.id === id)) return
      const latest = planningOf(current)
      const target = proposal ? latest.proposals.find(item => item.id === proposal.id && item.status === "pending") : latest.plans.find(item => item.id === plan.id)
      if (!target || target.particleIds.includes(id)) return
      const ids = [...target.particleIds]
      ids.splice(Math.min(plan.particleIds.indexOf(id), ids.length), 0, id)
      const links = [...(target.links ?? []), ...(plan.links ?? []).filter(link => (link.source === id || link.target === id) && ids.includes(link.source) && ids.includes(link.target))]
      if (proposal) void actions.update(current, { ...latest, proposals: latest.proposals.map(item => item.id === proposal.id ? { ...item, particleIds: ids, ...(links.length ? { links } : {}) } : item) })
      else void actions.savePlan(current, { ...plan, ...target, particleIds: ids, ...(links.length ? { links } : {}) })
    } } })
  }
  const move = (id: string, target: number) => {
    const ids = plan.particleIds.filter(value => value !== id)
    ids.splice(Math.max(0, target), 0, id)
    void save({ ...plan, particleIds: ids })
  }
  const drop = (raw: string, before?: string) => {
    const item = readParticleDrag(raw, objective.workspaceId)
    if (!item || item.kind !== "particle" || item.id === before) return
    const particle = controls.graph?.particles.find(value => value.id === item.id)
    if (!particle || particle.type === "objective") return
    if (plan.particleIds.includes(item.id)) {
      const remainder = plan.particleIds.filter(id => id !== item.id)
      move(item.id, before ? Math.max(0, remainder.indexOf(before)) : remainder.length)
    } else void add(particle)
  }
  const review = (status: "accepted" | "rejected") => {
    if (!proposal) return
    void actions.update(objective, {
      plans: status === "accepted" ? (planning.plans.some(item => item.id === proposal.planId) ? planning.plans.map(item => item.id === proposal.planId ? { ...plan, id: proposal.planId } : item) : [...planning.plans, { ...plan, id: proposal.planId }]) : planning.plans,
      proposals: planning.proposals.map(item => item.id === proposal.id ? { ...item, status, reviewedBy: userId, reviewedAt: new Date().toISOString() } : item),
    })
  }
  const base = planning.plans.find(item => item.id === plan.id)
  const added = proposal ? plan.particleIds.filter(id => !base?.particleIds.includes(id)) : []
  const removed = proposal ? (base?.particleIds ?? []).filter(id => !plan.particleIds.includes(id)) : []
  const unchanged = proposal && base && plan.title === base.title && JSON.stringify(plan.particleIds) === JSON.stringify(base.particleIds) && JSON.stringify(plan.links) === JSON.stringify(base.links) && plan.summary === base.summary && JSON.stringify(plan.sources) === JSON.stringify(base.sources)
  const stale = proposal && (planning.plans.find(item => item.id === proposal.planId)?.revision ?? null) !== proposal.baseRevision
  return <Collapsible open={open} onOpenChange={setOpen} className={`${styles.plan} ${proposal ? styles.proposal : ""}`}>
    <div className={`${styles.planHeader} flex min-h-10 min-w-0 items-center gap-1`}>
      {rename ? <ObjectiveInlineTitle initial={plan.title} pending={controls.pending} onCancel={() => setRename(false)} onSave={title => save({ ...plan, title })} /> : <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto min-h-10 min-w-0 flex-1 justify-start whitespace-normal rounded-xl px-2 text-left"><span className="min-w-0 break-words">{plan.title}{proposal && <span className="ml-2 text-xs font-normal text-muted-foreground">Proposed</span>}</span></Button></CollapsibleTrigger>}
      {proposal && actions.owner && <><Button size="icon" variant="ghost" className="size-9 rounded-full text-emerald-600 [@media(pointer:coarse)]:size-11" aria-label={`Accept ${plan.title}`} disabled={controls.pending || Boolean(stale) || Boolean(unchanged)} onClick={() => review("accepted")}><Check aria-hidden /></Button><Button size="icon" variant="ghost" className="size-9 rounded-full [@media(pointer:coarse)]:size-11" aria-label={`Reject ${plan.title}`} disabled={controls.pending} onClick={() => review("rejected")}><X aria-hidden /></Button></>}
      {controls.canEdit && !controls.error && <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-9 rounded-full [@media(pointer:coarse)]:size-11" disabled={controls.pending} aria-label={`Options for ${plan.title}`}><MoreHorizontal aria-hidden /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
        {editable && <DropdownMenuItem onSelect={() => setRename(true)}>Rename</DropdownMenuItem>}
        {!proposal && <DropdownMenuItem onSelect={() => void actions.propose(objective, plan)}>Propose changes</DropdownMenuItem>}
      </DropdownMenuContent></DropdownMenu>}
    </div>
    <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up motion-reduce:animate-none">
      {plan.summary && <p className="px-2 pb-2 text-xs text-muted-foreground">{plan.summary}</p>}
      {plan.sources?.length ? <ul aria-label="Research sources" className="flex flex-wrap gap-1 px-2 pb-2">{plan.sources.map(source=><li key={source.id}><a href={source.href} target={source.kind === "web" ? "_blank" : undefined} rel="noreferrer" className="inline-block max-w-60 truncate rounded-full bg-muted px-2 py-1 text-xs underline-offset-2 hover:underline" title={`${source.title} · Checked ${new Date(source.checkedAt).toLocaleDateString()}`}>{source.title}</a></li>)}</ul> : null}
      {stale && <p className="px-2 text-xs text-muted-foreground">Plan changed. Reject this proposal and propose changes from the current plan.</p>}
      {proposal && <p className="px-2 pb-1 text-xs text-muted-foreground">{base ? `${added.length} added · ${removed.length} removed${plan.title !== base.title ? " · Renamed" : ""}` : "New plan"}</p>}
      {removed.length > 0 && <ul aria-label="Proposed removals" className="px-2 text-sm text-muted-foreground">{removed.map(id => <li key={id} className="line-through">{controls.graph?.particles.find(item => item.id === id)?.title ?? "Removed particle"}</li>)}</ul>}
      <PlanParticleList label={`${plan.title} particles`} particles={plan.particleIds.flatMap(id => controls.graph?.particles.find(particle => particle.id === id) ?? [])} disabled={!editable || controls.pending} onMove={move} onDragOver={event => { if (editable && !controls.pending && event.dataTransfer.types.includes(PARTICLE_DRAG_MIME)) event.preventDefault() }} onDrop={event => { event.preventDefault(); if (editable && !controls.pending) drop(event.dataTransfer.getData(PARTICLE_DRAG_MIME)) }}>
        {plan.particleIds.map((id, index) => {
          const particle = controls.graph?.particles.find(item => item.id === id)
          return particle && <PlanParticleRow key={id} particle={particle} controls={controls} canOrganize={editable} first={index === 0} last={index === plan.particleIds.length - 1}
            onRemove={() => void remove(id)}
            onMove={direction => move(id, index + direction)} onDrop={raw => drop(raw, id)} />
        })}
      </PlanParticleList>
      {editable && <PlanParticlePicker particles={controls.graph?.particles ?? []} excluded={[objective.id, ...plan.particleIds]} pending={controls.pending} onAdd={add} onCreate={preset => {
        const particle = actions.create(objective, preset)
        return save({ ...plan, particleIds: [...plan.particleIds, particle.id] }, particle)
      }} />}
    </CollapsibleContent>
  </Collapsible>
}
