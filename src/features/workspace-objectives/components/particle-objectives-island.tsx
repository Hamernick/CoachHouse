"use client"
import { useRef, useState } from "react"
import { createParticle } from "@/features/workspace-particles/client"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CircularProgress } from "@/components/ui/circular-progress"
import { WorkspaceOpportunitiesFeed, type WorkspaceFinanceInput } from "@/features/workspace-finance"
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"
import type { ObjectiveScope } from "../island-types"
import { useParticlePlans, type PlanningControls } from "../hooks/use-particle-plans"
import { ObjectivesIslandSurface } from "./objectives-island-surface"
import { ParticleObjectiveCard } from "./particle-objective-card"
import { PlanParticleList } from "./plan-particle-list"
import { orderedObjectives, reorderObjectiveOperations } from "../lib/particle-objective-order"

export function ParticleObjectivesIsland({ scope, controls, finance }: { scope: ObjectiveScope; controls: PlanningControls; finance?: WorkspaceFinanceInput }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [tab, setTab] = useState("objectives")
  const [matchingResourceId, setMatchingResourceId] = useState<string | null>(null)
  const [opportunityCount, setOpportunityCount] = useState(() => finance?.opportunities?.length ?? 0)
  const pressedTab = useRef<string | null>(null)
  const actions = useParticlePlans(scope, controls)
  const objectives = orderedObjectives(controls.graph?.particles ?? [])
  const selectedResource = controls.graph?.particles.find(item => item.id === controls.selectedId && item.type === "activity")
    ?? controls.graph?.particles.find(item => item.id === matchingResourceId && item.type === "activity")
  const sortingDisabled = !controls.canEdit || controls.pending || Boolean(controls.error)
  const move = (id: string, index: number) => {
    if (sortingDisabled) return
    const target = objectives[index]
    const graph = controls.getCurrentGraph()
    if (!target || !graph) return
    const operations = reorderObjectiveOperations(graph.particles, id, target.id)
    if (operations.length) void controls.commit(operations, { optimistic: true })
  }
  const completed = objectives.filter(item => item.status === "done").length
  return <Tabs value={tab} onValueChange={value => { if(value === "opportunities") setMatchingResourceId(selectedResource?.id ?? null); setTab(value); setOpen(true) }} className="pointer-events-none w-[420px] max-w-full gap-0">
    <ObjectivesIslandSurface closedWidth={336} header={
      <TabsList aria-label="Workspace feeds" className="relative grid h-[42px] w-full grid-cols-2 rounded-full bg-muted/40 p-1 data-[orientation=horizontal]:h-[42px]">
        <TabsTrigger value="objectives" aria-label="Objectives" aria-expanded={open && tab === "objectives"} aria-description={`${completed} of ${objectives.length} objectives completed`} onPointerDownCapture={() => { pressedTab.current = tab }} onClick={event => { if (event.detail > 0 && pressedTab.current === "objectives") setOpen(value => !value) }} onKeyDown={event => { if (tab === "objectives" && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setOpen(value => !value) } }} className={`h-full justify-start gap-2 rounded-full border-0 px-3 shadow-none data-[state=active]:shadow-none ${open ? "grid grid-cols-[16px_minmax(0,1fr)_16px]" : ""}`}>
          <CircularProgress decorative value={objectives.length ? completed / objectives.length * 100 : 0} size={16} strokeWidth={2} className="shrink-0" progressClassName={completed === objectives.length && completed > 0 ? "stroke-emerald-600 dark:stroke-emerald-400" : "stroke-orange-600 dark:stroke-orange-400"} /><span className="inline-flex items-center justify-self-center gap-1"><span>Objectives</span><span className="tabular-nums">({objectives.length})</span></span>
        </TabsTrigger>
        <TabsTrigger value="opportunities" aria-label="Opportunities" aria-description={`${opportunityCount} opportunities`} aria-expanded={open && tab === "opportunities"} onPointerDownCapture={() => { pressedTab.current = tab }} onClick={event => { if (event.detail > 0 && pressedTab.current === "opportunities") setOpen(value => !value) }} onKeyDown={event => { if (tab === "opportunities" && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setOpen(value => !value) } }} className={`h-full gap-2 rounded-full border-0 px-3 shadow-none data-[state=active]:shadow-none ${open ? "justify-center" : "justify-start"}`}><span className="inline-flex items-center gap-1"><span>Opportunities</span><span className="tabular-nums">({opportunityCount})</span></span></TabsTrigger>
      </TabsList>
    } open={open} onOpenChange={setOpen} completed={objectives.filter(item => item.status === "done").length} total={objectives.length} footer={tab === "objectives" && controls.canEdit && !controls.error && <form onSubmit={async event => { event.preventDefault(); if (title.trim() && await actions.createObjective(title.trim())) setTitle("") }}>
        <InputGroup className="rounded-full bg-muted/30 p-1 shadow-none"><InputGroupInput aria-label="New objective" placeholder="What do you want to accomplish?" value={title} maxLength={240} required onChange={event => setTitle(event.target.value)} className="h-9 min-w-0 rounded-full border-0 bg-transparent shadow-none dark:bg-transparent focus-visible:ring-0" />
          <InputGroupAddon><Button size="icon" variant="ghost" type="submit" className="size-9 rounded-full" aria-label="Add objective" disabled={controls.pending}><Plus aria-hidden /></Button></InputGroupAddon>
        </InputGroup>
      </form>}>
    <TabsContent value="objectives" forceMount hidden={tab !== "objectives"} className="m-0">
    <div aria-busy={controls.pending} className="flex min-w-0 flex-col gap-1">
      {(controls.error || actions.accessError) && <p role="alert" className="px-2 py-1 text-xs text-destructive">{controls.error || actions.accessError}{controls.error && <Button variant="link" size="sm" onClick={() => void controls.retry()}>Retry</Button>}</p>}
      <PlanParticleList label="Objectives list" particles={objectives} disabled={sortingDisabled} onMove={move} className="min-w-0 space-y-1">
        {objectives.map(objective => <ParticleObjectiveCard key={objective.id} objective={objective} controls={controls} actions={actions} userId={scope.userId} />)}
      </PlanParticleList>
      {!objectives.length && <p className="px-2 py-3 text-sm text-muted-foreground">Add an objective to start your plan.</p>}

    </div>
    </TabsContent>
    <TabsContent value="opportunities" forceMount hidden={tab !== "opportunities"} className="m-0">
      <WorkspaceOpportunitiesFeed selectedResource={selectedResource} key={scope.organizationId} organizationId={scope.organizationId} opportunities={finance?.opportunities} state={finance?.opportunitiesState} canEdit={controls.canEdit} onCountChange={setOpportunityCount} onAddToWorkspace={async item => {
        const graph = controls.getCurrentGraph()
        if (!graph || !controls.canEdit || controls.pending) return false
        const existing = graph.particles.find(p => p.type === "activity" && p.data.widget?.kind === "opportunity" && p.data.widget.opportunityId === item.id && p.data.widget.organizationId === scope.organizationId)
        if (existing) {
          if (existing.canvasHidden && !await controls.commit([{ kind: "put_particle", particle: { ...existing, canvasHidden: false }, expectedRevision: existing.revision }])) return false
          controls.select(existing.id); return true
        }
        const particle = createParticle("activity", { id: crypto.randomUUID(), workspaceId: graph.workspaceId, title: item.title, now: new Date().toISOString() })
        if (particle.type !== "activity") return false
        particle.size = "large"
        particle.data.widget = { kind: "opportunity", organizationId: scope.organizationId, opportunityId: item.id }
        const canvas = document.querySelector("[data-workspace-canvas-flow-frame]")?.getBoundingClientRect()
        const position = canvas && controls.flow.current ? controls.flow.current.screenToFlowPosition({ x: canvas.left + canvas.width * 0.75, y: canvas.top + canvas.height / 2 }) : { x: 100, y: 100 }
        return controls.add("activity", item.title, position, particle, { inspect: false, optimistic: true })
      }} onOpenSource={id => controls.graph?.particles.some(item => item.id === id) ? controls.select(id) : false} />
    </TabsContent>
  </ObjectivesIslandSurface>
  </Tabs>
}
