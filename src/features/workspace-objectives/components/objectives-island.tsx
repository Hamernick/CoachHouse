"use client"
import { useCallback, useId, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { ObjectivesIslandSurface } from "./objectives-island-surface"
import type { ObjectiveIslandTransport, ObjectiveScope } from "../island-types"
import { useObjectiveIsland } from "../hooks/use-objective-island"
import type { ObjectivePlanProjection } from "./objective-plan-node"
import { ObjectivePlanEditor } from "./objective-plan-editor"
import { ObjectivePlanList } from "./objective-plan-list"
import { usePlanProjection } from "../hooks/use-plan-projection"
import { draftFromPlan, type ObjectivePlan, type PlanDraft } from "../plan-types"
import type { ObjectiveStep } from "../island-types"
import { AiPlanDialog } from "./ai-plan-dialog"
import type { WorkspaceObjectiveRecord } from "../types"
import { ObjectiveIslandCard } from "./objective-island-card"

export function ObjectivesIsland({ scope, canEdit, transport, onProjection }: {
  scope: ObjectiveScope; canEdit: boolean; transport: ObjectiveIslandTransport; onProjection?: (projection: ObjectivePlanProjection) => void
}) {
  return <ObjectivesIslandSession key={`${scope.userId}:${scope.organizationId}`} scope={scope} canEdit={canEdit} transport={transport} onProjection={onProjection} />
}
function ObjectivesIslandSession({ scope: suppliedScope, canEdit, transport, onProjection }: {
  scope: ObjectiveScope; canEdit: boolean; transport: ObjectiveIslandTransport; onProjection?: (projection: ObjectivePlanProjection) => void
}) {
  const { userId, organizationId } = suppliedScope
  const scope = useMemo(() => ({ userId, organizationId }), [userId, organizationId])
  const state = useObjectiveIsland(scope, transport)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [aiObjective, setAiObjective] = useState<WorkspaceObjectiveRecord | null>(null)
  const [aiPlan, setAiPlan] = useState<ObjectivePlan | null>(null)
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null)
  const [title, setTitle] = useState("")
  const id = useId()
  const objectives = state.data?.objectives.filter(objective => objective.status !== "archived") ?? []
  const activePlans = (state.data?.planning?.plans ?? []).filter(plan => objectives.some(objective => objective.id === plan.objectiveId))
  const completed = objectives.filter(objective => objective.status === "done").length
  const editable = canEdit && state.data?.loadedFrom === "normalized"
  const editPlan = useCallback((plan: ObjectivePlan) => { setOpen(true); setPlanDraft(draftFromPlan(plan, state.data?.steps ?? [])) }, [state.data?.steps])
  const { mutate } = state
  const onStep = useCallback((step: ObjectiveStep, done: boolean) => { void mutate(() => transport.step(scope, { id: step.id, objectiveId: step.objectiveId, expectedUpdatedAt: step.updatedAt, done })).then(saved => { if (!saved) setOpen(true) }) }, [mutate, transport, scope])
  const onChoice = useCallback((plan: ObjectivePlan, stepId: string, edgeId: string | null) => {
    const draft = draftFromPlan(plan, state.data?.steps ?? [])
    draft.decisions = (draft.decisions ?? []).map(decision => decision.stepId === stepId ? { ...decision, selectedEdgeId: edgeId } : decision)
    void mutate(() => transport.savePlan ? transport.savePlan(scope, draft) : Promise.resolve({ ok: false, error: "Plan editing is unavailable." })).then(saved => { if (!saved) setOpen(true) })
  }, [mutate, transport, scope, state.data?.steps])
  const projectionError = usePlanProjection({ data: state.data, selected, scopeKey: `${userId}:${organizationId}`, pending: state.pending, canEdit: Boolean(editable), onEdit: editPlan, onStep, onChoice, onProjection })
  return <ObjectivesIslandSurface open={open} completed={completed} total={objectives.length} onOpenChange={value => { setOpen(value); if (value) void state.refresh() }}>
    <div className="flex min-w-0 flex-col gap-2" style={planDraft || aiObjective ? { display: "none" } : undefined} inert={Boolean(planDraft || aiObjective)} aria-busy={state.pending}>
          {canEdit && state.data && state.data.loadedFrom !== "legacy_tracker" && <form className="w-full" onSubmit={async event => {
            event.preventDefault()
            if (title.trim() && await state.mutate(() => transport.create(scope, title))) setTitle("")
          }}>
            <Field className="min-w-0"><FieldLabel className="sr-only" htmlFor={id}>New objective</FieldLabel>
              <InputGroup className="items-center gap-0 rounded-full border border-border/70 bg-muted/30 p-1"><InputGroupInput id={id} placeholder="What do you want to accomplish?" value={title} onChange={event => setTitle(event.target.value)} maxLength={240} disabled={state.pending} className="h-9 min-w-0 rounded-full border-0 bg-transparent shadow-none dark:bg-transparent focus-visible:ring-0" />
            <InputGroupAddon>
            <Button type="submit" variant="ghost" size="icon" className="size-9 rounded-full" disabled={state.pending || !title.trim()} aria-label="Add objective"><Plus aria-hidden /></Button></InputGroupAddon></InputGroup></Field>
          </form>}
          {projectionError && <p role="alert" className="px-2 text-xs text-destructive">{projectionError}</p>}
          {state.error && <p role="alert" className="px-2 py-1 text-xs text-destructive">{state.error}</p>}
          {!state.data && state.pending && <Skeleton className="h-24 rounded-3xl" />}
          {state.data && !objectives.length && <p className="px-2 py-3 text-sm text-muted-foreground">No objectives yet.</p>}
          {objectives.map(objective => <ObjectiveIslandCard key={objective.id} objective={objective} plans={activePlans}
            steps={(state.data?.steps ?? []).filter(step => step.objectiveId === objective.id || state.data?.planning?.plans.some(plan => plan.objectiveId === objective.id && plan.stepIds.includes(step.id)))}
            checklistSteps={(state.data?.steps ?? []).filter(step => step.objectiveId === objective.id && !state.data?.planning?.plans.some(plan => plan.objectiveId === objective.id && plan.stepIds.includes(step.id)))} editable={editable} pending={state.pending}
            onEdit={input => state.mutate(() => transport.edit(scope, input))}
            onStep={onStep}>
            {state.data?.planning?.available && <ObjectivePlanList onRevise={transport.ai && state.data.planning.decisionsAvailable ? plan => { setAiPlan(plan); setAiObjective(objective) } : undefined} onChoice={onChoice} allPlans={activePlans} plans={state.data.planning.plans.filter(plan => plan.objectiveId === objective.id)} steps={state.data.steps}
              canEdit={Boolean(editable) && objective.kind === "custom"} pending={state.pending} visible={selected}
              onToggle={id => { setSelected(value => value.includes(id) ? value.filter(item => item !== id) : [...value, id]); setOpen(false) }}
              onRename={(plan, title) => state.mutate(() => transport.savePlan ? transport.savePlan(scope, { ...draftFromPlan(plan, state.data?.steps ?? []), title }) : Promise.resolve({ ok: false, error: "Plan editing is unavailable." }))} onStep={onStep} onCreate={() => setPlanDraft({ id: crypto.randomUUID(), objectiveId: objective.id, revision: 0, title: "", steps: [], edges: [] })} />}
            {editable && objective.kind === "custom" && state.data?.planning?.decisionsAvailable && transport.ai && <Button variant="ghost" size="sm" className="rounded-full" disabled={state.pending} onClick={() => { setAiPlan(null); setAiObjective(objective) }}>Plan with AI</Button>}
          </ObjectiveIslandCard>)}
    </div>
    {aiObjective && transport.ai && <AiPlanDialog plan={aiPlan ?? undefined} key={`${aiObjective.id}:${aiPlan?.id ?? "new"}`} scope={scope} objective={aiObjective} transport={transport.ai} onClose={() => setAiObjective(null)} onChanged={() => void state.refresh()} />}
    {planDraft && <ObjectivePlanEditor decisionsAvailable={state.data?.planning?.decisionsAvailable} key={planDraft.id} initial={planDraft} connectedStepIds={(state.data?.planning?.plans ?? []).flatMap(plan => plan.stepIds)} allSteps={(state.data?.steps ?? []).filter(step => step.editable && state.data?.objectives.some(objective => objective.id === step.objectiveId && objective.kind === "custom"))}
      pending={state.pending} error={state.error} onClose={() => setPlanDraft(null)} onSave={draft => state.mutate(() => transport.savePlan ? transport.savePlan(scope, draft) : Promise.resolve({ ok: false, error: "Plan editing is unavailable." }))} />}
  </ObjectivesIslandSurface>
}
