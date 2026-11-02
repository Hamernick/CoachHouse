"use client"

import { ParticleButton as Button, ParticleButton, ParticleMenu } from "@/components/ui/particle-ui"
import { useRef, useState } from "react"
import { toast } from "@/lib/toast"
import { MoreHorizontal, Check, X, ChevronRight } from "lucide-react"

import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible"

import { summarizePlanWork, isParticleWork, particlePlanBranchStates, particlePlanBranchLabel, PARTICLE_DRAG_MIME, readParticleDrag, type ParticlePlan, type ParticlePlanProposal, type Particle } from "@/features/workspace-particles/client"
import { PlanParticlePicker } from "./plan-particle-picker"
import { PlanMemberResponsibility } from "./plan-member-responsibility"
import { PlanParticleRow } from "./plan-particle-row"
import { PlanParticleList } from "./plan-particle-list"
import { PlanSubmenuRail } from "./plan-submenu-rail"
import { ObjectiveInlineTitle } from "./objective-inline-title"
import { planningOf, type ObjectiveParticle, type PlanningControls, type useParticlePlans } from "../hooks/use-particle-plans"
import { PlanningDisclosure } from "./planning-disclosure"
import { PlanWalkthroughControls } from "./plan-walkthrough-controls"
import styles from "./particle-objectives.module.css"

type Actions = ReturnType<typeof useParticlePlans>
export function ParticlePlanBranch({ objective, plan, proposal, controls, actions, userId, onRevise }: {
  objective: ObjectiveParticle; plan: ParticlePlan; proposal?: ParticlePlanProposal; controls: PlanningControls; actions: Actions; userId: string; onRevise?: () => void
}) {
  const [rename, setRename] = useState(false)
  const [open, setOpen] = useState(true)
  const optionsRef = useRef<HTMLButtonElement>(null)
  const walkthrough = controls.walkthrough
  const walking = walkthrough?.reference?.objectiveId === objective.id && walkthrough.reference.planId === plan.id && walkthrough.reference.proposalId === proposal?.id
  const planning = planningOf(objective)
  const branchStates=particlePlanBranchStates(plan,controls.graph?.particles ?? [])
  const progress = summarizePlanWork([plan], controls.graph?.particles ?? [])
  const editable = controls.canEdit && !controls.error && (proposal ? actions.owner || proposal.authorId === userId : actions.owner)
  const save = (value: ParticlePlan, created?: Particle) => proposal
    ? actions.update(objective, { ...planning, proposals: planning.proposals.map(item => item.id === proposal.id ? { ...item, title: value.title, particleIds: value.particleIds, assignments: value.assignments, optionalParticleIds: value.optionalParticleIds, ...(value.links ? { links: value.links } : {}) } : item) }, created)
    : actions.savePlan(objective, value, created)
  const add = (particle: Particle) => save({ ...plan, particleIds: [...plan.particleIds.filter(id => id !== particle.id), particle.id] }, particle.canvasHidden ? particle : undefined)
  const remove = async (id: string) => {
    if (!await save({ ...plan, particleIds: plan.particleIds.filter(value => value !== id), optionalParticleIds: plan.optionalParticleIds?.filter(value => value !== id), assignments: plan.assignments?.filter(item => item.particleId !== id), links: plan.links?.filter(link=>link.source!==id && link.target!==id) })) return
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
      const optionalParticleIds = [...(target.optionalParticleIds ?? []), ...(plan.optionalParticleIds ?? []).filter(value => value === id)]
      const assignments = [...(target.assignments ?? []), ...(plan.assignments ?? []).filter(item => item.particleId === id)]
      if (proposal) void actions.update(current, { ...latest, proposals: latest.proposals.map(item => item.id === proposal.id ? { ...item, particleIds: ids, assignments, optionalParticleIds, ...(links.length ? { links } : {}) } : item) })
      else void actions.savePlan(current, { ...plan, ...target, particleIds: ids, assignments, optionalParticleIds, ...(links.length ? { links } : {}) })
    } } })
  }
  const setCondition = (id:string,source:string,outcome:string,selected:boolean) => {
    if(!editable || controls.pending)return
    // A named branch replaces an unconditional relationship from the same decision.
    const links=(plan.links ?? []).filter(link=>!(link.source===source && link.target===id && (!link.outcome || link.outcome===outcome)))
    if(selected)links.push({source,target:id,outcome})
    void save({...plan,links})
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
  const linkKey = (link: NonNullable<ParticlePlan["links"]>[number]) => `${link.source}:${link.target}:${link.outcome ?? ""}`
  const addedLinks = (plan.links ?? []).filter(link => !(base?.links ?? []).some(value => linkKey(value) === linkKey(link)))
  const removedLinks = (base?.links ?? []).filter(link => !(plan.links ?? []).some(value => linkKey(value) === linkKey(link)))
  const unchanged = proposal && base && plan.title === base.title && JSON.stringify(plan.particleIds) === JSON.stringify(base.particleIds) && JSON.stringify(plan.optionalParticleIds) === JSON.stringify(base.optionalParticleIds) && JSON.stringify(plan.assignments) === JSON.stringify(base.assignments) && JSON.stringify(plan.links) === JSON.stringify(base.links) && plan.summary === base.summary && JSON.stringify(plan.sources) === JSON.stringify(base.sources)
  const stale = proposal && (planning.plans.find(item => item.id === proposal.planId)?.revision ?? null) !== proposal.baseRevision
  const focusedId = controls.canvasSelectedId ?? controls.selectedId
  const selected = plan.particleIds.includes(focusedId ?? "")
  return <Collapsible data-selected={selected} data-proposal={Boolean(proposal)} open={open} onOpenChange={setOpen} className={`${styles.plan} ${proposal ? styles.proposal : ""}`}>
    <div className={`${styles.planHeader} flex min-h-8 min-w-0 items-center gap-1 [@media(pointer:coarse)]:min-h-11`}>
      {rename ? <ObjectiveInlineTitle initial={plan.title} pending={controls.pending} onCancel={() => { setRename(false); requestAnimationFrame(() => optionsRef.current?.focus({ preventScroll: true })) }} onSave={title => save({ ...plan, title })} /> : <CollapsibleTrigger asChild><Button color="secondary" size="lg" variant="ghost" className="h-auto min-h-8 min-w-0 flex-1 justify-start whitespace-normal rounded-md px-2 py-1 has-[>svg]:px-2 text-left [@media(pointer:coarse)]:min-h-11"><ChevronRight aria-hidden className={`size-[18px] shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`} /><span className="min-w-0 break-words">{plan.title}{proposal && <span className={styles.reviewLabel}>Proposed</span>}</span></Button></CollapsibleTrigger>}
      {proposal && actions.owner && <><Button color="secondary" uniform size="lg" variant="ghost" className="size-9 rounded-full text-emerald-600 [@media(pointer:coarse)]:size-11" aria-label={`Accept ${plan.title}`} disabled={controls.pending || Boolean(stale) || Boolean(unchanged)} onClick={() => review("accepted")}><Check aria-hidden /></Button><Button color="secondary" uniform size="lg" variant="ghost" className="size-9 rounded-full [@media(pointer:coarse)]:size-11" aria-label={`Reject ${plan.title}`} disabled={controls.pending} onClick={() => review("rejected")}><X aria-hidden /></Button></>}
      {!controls.error && <ParticleMenu><ParticleMenu.Trigger><ParticleButton ref={optionsRef} color="secondary" size="2xl" uniform pill={false} variant="ghost" className="particle-ui shrink-0" disabled={controls.pending} aria-label={`Options for ${plan.title}`}><MoreHorizontal aria-hidden /></ParticleButton></ParticleMenu.Trigger><ParticleMenu.Content align="end" minWidth={220}>
        <ParticleMenu.Item className="particle-ui-menu" disabled={!walkthrough || !plan.particleIds.length} onSelect={() => walkthrough.start({ workspaceId: objective.workspaceId, objectiveId: objective.id, planId: plan.id, ...(proposal ? { proposalId: proposal.id } : {}) }, optionsRef.current)}>Walk through</ParticleMenu.Item>
        {editable && <ParticleMenu.Item className="particle-ui-menu" onSelect={() => setRename(true)}>Rename</ParticleMenu.Item>}
        {controls.canEdit && !proposal && <ParticleMenu.Item className="particle-ui-menu" onSelect={() => void actions.propose(objective, plan)}>Propose changes</ParticleMenu.Item>}
        {controls.canEdit && !proposal && onRevise && <ParticleMenu.Item className="particle-ui-menu" onSelect={onRevise}>Revise with AI</ParticleMenu.Item>}
      </ParticleMenu.Content></ParticleMenu>}
    </div>
    {!proposal && <p className="px-2 pb-1 text-xs tabular-nums text-muted-foreground">{progress.percent === null ? "No required work" : `${progress.completed} of ${progress.total} required work complete${objective.data.progress?.mode === "ongoing" ? "" : ` · ${progress.percent}%`}${progress.visibleScope ? " · Visible scope" : ""}`}</p>}
    {walking && <PlanWalkthroughControls walkthrough={walkthrough} />}
    <PlanningDisclosure open={open}>
      {plan.sources?.length ? <ul aria-label="Research sources" className="flex flex-wrap gap-1 px-2 pb-2">{plan.sources.map(source=><li key={source.id}><a href={source.href} target={source.kind === "web" ? "_blank" : undefined} rel="noreferrer" className="inline-block max-w-60 truncate rounded-full bg-muted px-2 py-1 text-xs underline-offset-2 hover:underline" title={`${source.title} · Checked ${new Date(source.checkedAt).toLocaleDateString()}`}>{source.title}</a></li>)}</ul> : null}
      {stale && <p className="px-2 text-xs text-muted-foreground">Plan changed. Reject this proposal and propose changes from the current plan.</p>}
      {proposal && <p className="px-2 pb-1 text-xs text-muted-foreground">{base ? `${added.length} added · ${removed.length} removed from plan · ${addedLinks.length + removedLinks.length} relationship changes${plan.title !== base.title ? " · Renamed" : ""}${JSON.stringify(plan.optionalParticleIds) !== JSON.stringify(base.optionalParticleIds) ? " · Required work changed" : ""}${JSON.stringify(plan.assignments) !== JSON.stringify(base.assignments) ? " · Responsibility changed" : ""}` : "New plan"}</p>}
      {proposal && base && <p className="px-2 pb-1 text-xs text-muted-foreground">Existing content and completion stay unchanged. Removed items remain in the workspace.</p>}
      {proposal && base && (addedLinks.length > 0 || removedLinks.length > 0) && <ul aria-label="Proposed relationship changes" className="px-2 pb-1 text-xs text-muted-foreground">{[...addedLinks.map(link=>({link,change:"Add"})),...removedLinks.map(link=>({link,change:"Remove"}))].map(({link,change})=><li key={`${change}:${linkKey(link)}`}>{change}: {controls.graph?.particles.find(item=>item.id===link.source)?.title ?? "Item"} → {controls.graph?.particles.find(item=>item.id===link.target)?.title ?? "Item"}{link.outcome ? ` (${controls.graph?.particles.flatMap(item=>item.type === "decision" ? item.data.outcomes : []).find(outcome=>outcome.id===link.outcome)?.label ?? "Decision outcome"})` : ""}</li>)}</ul>}
      {removed.length > 0 && <ul aria-label="Proposed removals" className="px-2 text-sm text-muted-foreground">{removed.map(id => <li key={id} className="line-through">{controls.graph?.particles.find(item => item.id === id)?.title ?? "Removed particle"}</li>)}</ul>}
      <PlanSubmenuRail selectedId={focusedId}>
      <PlanParticleList className={styles.memberList} label={`${plan.title} particles`} particles={plan.particleIds.flatMap(id => controls.graph?.particles.find(particle => particle.id === id) ?? [])} disabled={!editable || controls.pending} onMove={move} onDragOver={event => { if (editable && !controls.pending && event.dataTransfer.types.includes(PARTICLE_DRAG_MIME)) event.preventDefault() }} onDrop={event => { event.preventDefault(); if (editable && !controls.pending) drop(event.dataTransfer.getData(PARTICLE_DRAG_MIME)) }}>
        {plan.particleIds.map((id, index) => {
          const particle = controls.graph?.particles.find(item => item.id === id)
          return particle && <PlanParticleRow branchState={branchStates.get(id)} branchLabel={particlePlanBranchLabel(plan,id,controls.graph?.particles ?? [])} key={id} optional={Boolean(plan.optionalParticleIds?.includes(id))} onOptional={isParticleWork(particle) ? optional => void save({ ...plan, optionalParticleIds: optional ? [...(plan.optionalParticleIds ?? []).filter(value => value !== id), id] : (plan.optionalParticleIds ?? []).filter(value => value !== id) }) : undefined} particle={particle} controls={controls} canOrganize={editable} first={index === 0} last={index === plan.particleIds.length - 1}
            responsibility={particle.canvasHidden || !controls.assignmentOnCanvas ? <PlanMemberResponsibility title={particle.title} planTitle={plan.title} revision={objective.revision}
              value={plan.assignments?.find(item => item.particleId === id)?.responsibility} disabled={controls.pending || Boolean(controls.error)} editable={editable}
              onSave={responsibility => save({ ...plan, assignments: [...(plan.assignments ?? []).filter(item => item.particleId !== id), { particleId: id, responsibility }] })} /> : undefined}
            conditions={plan.particleIds.filter(source=>source!==id).flatMap(source=>{
              const decision=controls.graph?.particles.find(item=>item.id===source)
              return decision?.type === "decision" ? decision.data.outcomes.map(outcome=>({source,outcome:outcome.id,label:`${decision.title}: ${outcome.label}`,selected:Boolean(plan.links?.some(link=>link.source===source&&link.target===id&&link.outcome===outcome.id))})) : []
            })}
            onCondition={(source,outcome,selected)=>setCondition(id,source,outcome,selected)}
            onRemove={() => void remove(id)}
            onMove={direction => move(id, index + direction)} onDrop={raw => drop(raw, id)} />
        })}
      </PlanParticleList>
      {editable && <div className={styles.memberList}><div data-plan-add className={styles.memberRow}><PlanParticlePicker particles={controls.graph?.particles ?? []} excluded={[objective.id, ...plan.particleIds]} pending={controls.pending} onAdd={add} onCreate={preset => {
        const particle = actions.create(objective, preset)
        return save({ ...plan, particleIds: [...plan.particleIds, particle.id] }, particle)
      }} /></div></div>}
      </PlanSubmenuRail>
    </PlanningDisclosure>
  </Collapsible>
}
