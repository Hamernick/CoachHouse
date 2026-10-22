import { ReactFlow, Background } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { ObjectivePlanNode } from "../../../src/features/workspace-objectives/components/objective-plan-node"
import { ObjectivePlanViewport } from "../../../src/features/workspace-objectives/components/objective-plan-viewport"
import { useObjectiveCanvas } from "../../../src/features/workspace-objectives/hooks/use-objective-canvas"
import { useState } from "react"
import { ObjectivesIsland } from "../../../src/features/workspace-objectives/components/objectives-island"
import { Button } from "../../../src/components/ui/button"
import type { ObjectiveIslandData, ObjectiveIslandTransport } from "../../../src/features/workspace-objectives/island-types"
import { objectiveAiTransport } from "./objective-ai-transport"
import { scope } from "./fixture-data"

const id = "00000000-0000-4000-8000-000000000071"
const date = "2026-10-22T12:00:00Z"
const nodeTypes = { objectivePlanStep: ObjectivePlanNode }
const initial: ObjectiveIslandData = { planning: { available: true, decisionsAvailable: true, plans: [] }, loadedFrom: "normalized", groups: [], objectives: [{
  id, orgId: scope.organizationId, groupId: null, title: "Launch a volunteer program", description: "Recruit and train our first team.",
  status: "in_progress", priority: "normal", kind: "custom", sourceType: "custom", sourceKey: null, dueAt: null,
  completedAt: null, positionRank: 0, createdBy: scope.userId, updatedBy: null, createdAt: date, updatedAt: date, assignees: [], links: [],
}], steps: ["Define volunteer roles", "Recruit the first team", "Schedule orientation"].map((title, index) => ({
  id: `00000000-0000-4000-8000-00000000008${index}`, objectiveId: id, title, status: index === 0 ? "done" : "todo", order: index, editable: true, updatedAt: date,
})) }
const read = (): ObjectiveIslandData => JSON.parse(localStorage.getItem("objective-fixture") || JSON.stringify(initial))
const save = (data: ObjectiveIslandData) => localStorage.setItem("objective-fixture", JSON.stringify(data))
const transport: ObjectiveIslandTransport = {
  async savePlan(_, draft) {
    const data = read(); const plans = data.planning!.plans; const existing = plans.find(plan => plan.id === draft.id)
    if ((existing?.revision ?? 0) !== draft.revision || draft.steps.some(step => step.expectedUpdatedAt && data.steps.find(item => item.id === step.id)?.updatedAt !== step.expectedUpdatedAt)) return { ok: false, error: "This plan or step changed. Refresh, then reopen the editor." }
    draft.steps.forEach(step => {
      const current = data.steps.find(item => item.id === step.id)
      if (current) Object.assign(current, { title: step.title, status: step.status, updatedAt: new Date().toISOString() })
      else data.steps.push({ id: step.id, title: step.title, status: step.status, objectiveId: draft.objectiveId, editable: true, order: data.steps.length, updatedAt: new Date().toISOString() })
    })
    const plan = { id: draft.id, objectiveId: draft.objectiveId, title: draft.title, revision: draft.revision + 1, stepIds: draft.steps.map(step => step.id), edges: draft.edges, decisions: draft.decisions ?? existing?.decisions ?? [] }
    if (existing) Object.assign(existing, plan); else plans.push(plan)
    save(data); return { ok: true }
  },
  async load(target) { return { ok: true, data: target.organizationId === scope.organizationId ? read() : { ...initial, objectives: [], steps: [] } } },
  async create(_, title) {
    const data = read(); data.objectives.push({ ...initial.objectives[0], id: crypto.randomUUID(), title, description: null, status: "todo" }); save(data); return { ok: true }
  },
  async edit(_, input) {
    const data = read(); const objective = data.objectives.find(item => item.id === input.id)!
    if (objective.updatedAt !== input.expectedUpdatedAt) return { ok: false, error: "This objective changed. Refresh before editing again." }
    Object.assign(objective, input, { updatedAt: new Date().toISOString() }); save(data); return { ok: true }
  },
  async step(_, input) {
    const data = read(); const step = data.steps.find(item => item.id === input.id)!
    step.status = input.done ? "done" : "todo"; step.updatedAt = new Date().toISOString(); save(data); return { ok: true }
  },
}
transport.ai = objectiveAiTransport(read, save, transport.savePlan!)
export function ObjectivesFixture() {
  const [sourceScope, setScope] = useState(scope)
  const canvas = useObjectiveCanvas(`${sourceScope.userId}:${sourceScope.organizationId}`, true, [])
  return <main className="relative min-h-dvh bg-muted/40 p-2 text-foreground">
    <div className="absolute inset-0"><ReactFlow onlyRenderVisibleElements nodes={canvas.nodes} edges={canvas.edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false}><Background /><ObjectivePlanViewport focusKey={canvas.focusKey} /></ReactFlow></div>
    <div className="pointer-events-auto absolute inset-x-2 bottom-2 z-10 w-fit rounded-xl bg-card/95 p-2">
    <p className="text-xs text-muted-foreground">Fictional local fixture. Simulated persistence; no production connection.</p>
    <Button variant="ghost" onClick={() => setScope({ ...scope, organizationId: "00000000-0000-4000-8000-000000000099" })}>Switch fixture organization</Button>
    <Button variant="ghost" onClick={() => { const data = read(); data.objectives[0].updatedAt = new Date().toISOString(); data.objectives[0].title = "Collaborator objective"; save(data) }}>Simulate collaborator edit</Button>
    </div>
    <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex justify-center"><ObjectivesIsland scope={sourceScope} canEdit transport={transport} onProjection={canvas.onProjection} /></div>
  </main>
}
