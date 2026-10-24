import { describe, expect, it } from "vitest"
import { orderedObjectives, reorderObjectiveOperations } from "@/features/workspace-objectives/lib/particle-objective-order"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { particleGraphSchema } from "@/features/workspace-particles/lib/particle-schema"
import { particlePlanningPermissionError } from "@/features/workspace-particles/lib/particle-plan-authority"
import { batch, graph, ID, NOW, particle } from "./fixtures/particle-fixtures"

const makeGraph = () => graph([particle(1, "objective"), particle(2), particle(3, "objective"), particle(4, "objective")])

describe("objective list ordering", () => {
  it("preserves existing display order until explicitly reordered", () => {
    expect(orderedObjectives(makeGraph().particles).map(item => item.id)).toEqual([ID(1), ID(3), ID(4)])
  })
  it.each([[1, 4, [3, 4, 1]], [4, 1, [4, 1, 3]]] as const)("persists %s to %s without moving canvas nodes or changing plans", async (from, to, expected) => {
    const original = makeGraph()
    const objective = original.particles[0]
    if (objective.type !== "objective") throw new Error("Expected objective")
    objective.data.planning = { plans: [{ id: ID(30), title: "Plan", revision: 0, particleIds: [ID(2)] }], proposals: [] }
    const operations = reorderObjectiveOperations(original.particles, ID(from), ID(to))
    const result = await applyParticleBatch(original, batch(50, operations), NOW)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const restored = particleGraphSchema.parse(JSON.parse(JSON.stringify(result.value.graph)))
    expect(orderedObjectives(restored.particles).map(item => item.id)).toEqual(expected.map(ID))
    expect(restored.particles.map(item => item.position)).toEqual(original.particles.map(item => item.position))
    expect(restored.particles.find(item => item.id === ID(2))).toEqual(original.particles[1])
    const saved = restored.particles.find(item => item.id === ID(1))
    expect(saved?.type === "objective" && saved.data.planning).toEqual(objective.data.planning)
    expect(particlePlanningPermissionError(particleGraphSchema.parse(original), restored, { userId: ID(90), isOrganizationOwner: false }, NOW)).toBeNull()
    const undone = await applyParticleBatch(restored, batch(51, result.value.inverse, restored.revision), NOW)
    expect(undone.ok).toBe(true)
    if (undone.ok) expect(orderedObjectives(undone.value.graph.particles).map(item => item.id)).toEqual([ID(1), ID(3), ID(4)])
  })
  it("appends newly created objectives after saved ordered objectives", async () => {
    const original = makeGraph()
    const result = await applyParticleBatch(original, batch(50, reorderObjectiveOperations(original.particles, ID(4), ID(1))), NOW)
    if (!result.ok) throw new Error(result.error)
    expect(orderedObjectives([...result.value.graph.particles, particle(5, "objective")]).map(item => item.id)).toEqual([ID(4), ID(1), ID(3), ID(5)])
  })
  it.each([[1, 1], [99, 1], [1, 99], [2, 1]])("ignores unchanged or invalid move %s to %s", (from, to) => {
    expect(reorderObjectiveOperations(makeGraph().particles, ID(from), ID(to))).toEqual([])
  })
  it("rejects stale revisions rather than overwriting a concurrent edit", async () => {
    const original = makeGraph()
    const operations = reorderObjectiveOperations(original.particles, ID(4), ID(1))
    original.particles[0].revision = 1
    original.revision = 1
    const result = await applyParticleBatch(original, batch(50, operations), NOW)
    expect(result).toMatchObject({ ok: false, code: "conflict" })
    expect(orderedObjectives(original.particles).map(item => item.id)).toEqual([ID(1), ID(3), ID(4)])
  })
})
