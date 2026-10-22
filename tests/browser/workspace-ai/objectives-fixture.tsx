import { useState } from "react"
import { ObjectivesIsland } from "../../../src/features/workspace-objectives/components/objectives-island"
import { Button } from "../../../src/components/ui/button"
import type { ObjectiveIslandData, ObjectiveIslandTransport } from "../../../src/features/workspace-objectives/island-types"
import { scope } from "./fixture-data"

const id = "00000000-0000-4000-8000-000000000071"
const date = "2026-10-22T12:00:00Z"
const initial: ObjectiveIslandData = { loadedFrom: "normalized", groups: [], objectives: [{
  id, orgId: scope.organizationId, groupId: null, title: "Launch a volunteer program", description: "Recruit and train our first team.",
  status: "in_progress", priority: "normal", kind: "custom", sourceType: "custom", sourceKey: null, dueAt: null,
  completedAt: null, positionRank: 0, createdBy: scope.userId, updatedBy: null, createdAt: date, updatedAt: date, assignees: [], links: [],
}], steps: ["Define volunteer roles", "Recruit the first team", "Schedule orientation"].map((title, index) => ({
  id: `step-${index}`, objectiveId: id, title, status: index === 0 ? "done" : "todo", order: index, editable: true, updatedAt: date,
})) }
const read = (): ObjectiveIslandData => JSON.parse(localStorage.getItem("objective-fixture") || JSON.stringify(initial))
const save = (data: ObjectiveIslandData) => localStorage.setItem("objective-fixture", JSON.stringify(data))
const transport: ObjectiveIslandTransport = {
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
export function ObjectivesFixture() {
  const [sourceScope, setScope] = useState(scope)
  return <main className="relative min-h-dvh bg-muted/40 p-2 text-foreground">
    <p className="mt-20 text-xs text-muted-foreground">Fictional local fixture. Simulated persistence; no production connection.</p>
    <Button variant="ghost" onClick={() => setScope({ ...scope, organizationId: "00000000-0000-4000-8000-000000000099" })}>Switch fixture organization</Button>
    <Button variant="ghost" onClick={() => { const data = read(); data.objectives[0].updatedAt = new Date().toISOString(); data.objectives[0].title = "Collaborator objective"; save(data) }}>Simulate collaborator edit</Button>
    <div className="pointer-events-none absolute inset-x-2 top-2 flex justify-center"><ObjectivesIsland scope={sourceScope} canEdit transport={transport} /></div>
  </main>
}
