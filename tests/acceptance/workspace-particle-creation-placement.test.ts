import { describe, expect, it, vi } from "vitest"
import type { Node } from "@xyflow/react"
import type { ParticleNodeData } from "@/features/workspace-particles/components/particle-node"
import { particleArrangementIds, particleCreationPosition, particlePlacementBounds, newlyAttachedParticles, UNASSIGNED_ORIGIN } from "@/features/workspace-particles/lib/particle-creation-placement"
import { particleConnectionsToFlow } from "@/features/workspace-particles/lib/particle-flow-adapters"
import { animateParticleNodes, particleNodeTransition } from "@/features/workspace-particles/lib/particle-node-transition"
import type { Particle, ParticlePlan } from "@/features/workspace-particles/client"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { graph, particle, ID, batch, NOW } from "./fixtures/particle-fixtures"

const objective = () => {
  const item = particle(1, "objective")
  if (item.type !== "objective") throw new Error("Expected objective")
  item.position = { x: 100, y: 100 }
  return item
}
const plan = (ids: string[] = []): ParticlePlan => ({ id: ID(50), title: "Preparation", revision: 0, particleIds: ids })

describe("Contextual creation placement", () => {
  it("keeps global additions in Unassigned regardless of unrelated positions", () => {
    const source = graph([objective()])
    const first = { ...particle(2), position: particleCreationPosition(source, particle(2)) }
    expect(first.position).toEqual(UNASSIGNED_ORIGIN)
    const next = particleCreationPosition(graph([...source.particles, first]), particle(3))
    expect(next.x).toBe(first.position.x)
    expect(next.y).toBeGreaterThan(first.position.y + particlePlacementBounds(first).height)
    expect(source.particles[0].position).toEqual({ x: 100, y: 100 })
  })
  it("places plan peers together without creating dependencies or moving manual obstacles", () => {
    const root = objective()
    const manual = { ...particle(3), positionMode: "manual" as const, position: { x: 644, y: 100 } }
    const source = graph([root, manual])
    const planning = { plans: [plan([ID(2), ID(3)])], proposals: [] }
    const additions = newlyAttachedParticles(source, root, planning, particle(2))
    expect(additions).toHaveLength(1)
    expect(additions[0].position.x).toBe(644)
    expect(additions[0].position.y).toBeGreaterThan(manual.position.y + particlePlacementBounds(manual).height)
    expect(manual.position).toEqual({ x: 644, y: 100 })
    expect(planning.plans[0].links).toBeUndefined()
    expect(source.connections).toEqual([])
  })
  it("uses measured sizes and treats other canvas tools as obstacles", () => {
    const source = graph([objective()])
    const position = particleCreationPosition(source, particle(2), undefined, [{ id: "workspace-tool", x: -1100, y: 100, width: 900, height: 700 }])
    expect(position).toEqual({ x: -1100, y: 880 })
  })
  it("does not partially place an item when membership has a revision conflict", async () => {
    const root = objective()
    const source = graph([root])
    const planning = { plans: [plan([ID(2)])], proposals: [] }
    const placed = newlyAttachedParticles(source, root, planning, particle(2))
    const result = await applyParticleBatch(source, batch(80, [
      { kind: "put_particle", particle: placed[0], expectedRevision: null },
      { kind: "put_particle", particle: { ...root, data: { ...root.data, planning } }, expectedRevision: 99 },
    ]), NOW)
    expect(result.ok).toBe(false)
    expect(source.particles).toEqual([root])
  })
  it("advances columns only for explicit dependencies", () => {
    const root = objective()
    const predecessor = { ...particle(2), position: { x: 644, y: 100 } }
    const branch = { ...plan([ID(2), ID(3)]), links: [{ source: ID(2), target: ID(3) }] }
    const position = particleCreationPosition(graph([root, predecessor]), particle(3), { objective: root, plan: branch })
    expect(position.x).toBeGreaterThan(predecessor.position.x + particlePlacementBounds(predecessor).width)
  })
  it("keeps shared membership and locked cards at their existing positions", () => {
    const root = objective()
    root.data.planning = { plans: [plan([ID(2)])], proposals: [] }
    const locked = { ...particle(3), locked: true }
    const planning = { plans: [...root.data.planning.plans, { ...plan([ID(2), ID(3)]), id: ID(51) }], proposals: [] }
    expect(newlyAttachedParticles(graph([root, particle(2), locked]), root, planning)).toEqual([])
  })
  it("whole-board arrange excludes manual and unassigned cards unless explicitly selected", () => {
    const root = objective()
    root.data.planning = { plans: [plan([ID(2), ID(3)])], proposals: [] }
    const source = graph([root, particle(2), { ...particle(3), positionMode: "manual" }, particle(4)])
    expect(particleArrangementIds(source)).toEqual([ID(1), ID(2)])
    expect(particleArrangementIds(source, new Set([ID(3), ID(4)]))).toEqual([ID(3), ID(4)])
  })
  it("renders resource support and explicit dependencies as distinct relationships", () => {
    const root = objective()
    const document = particle(3)
    if (document.type !== "activity") throw new Error("Expected activity")
    document.data.widget = { kind: "notes", source: { kind: "workspace", content: "Source material" } }
    root.data.planning = { plans: [{ ...plan([ID(2), ID(3), ID(4)]), links: [{ source: ID(2), target: ID(4) }] }], proposals: [] }
    const edges = particleConnectionsToFlow(graph([root, particle(2), document, particle(4)]))
    const support = edges.find(item => item.target === ID(3))!
    expect(support.style?.strokeDasharray).toBeTruthy()
    expect(support.markerEnd).toBeUndefined()
    expect(support.ariaLabel).toContain("Supporting resource")
    expect(edges.find(item => item.target === ID(4))?.markerEnd).toBeTruthy()
    expect(edges.some(item => item.source === ID(2) && item.target === ID(3))).toBe(false)
  })
})

const node = (item: Particle): Node<ParticleNodeData> => ({ id: item.id, position: item.position, data: { particle: item, editable: true, onOpen: () => {}, onEdit: () => {} } })
describe("Minimal canvas motion", () => {
  it("moves managed nodes and their React Flow coordinates, leaving manual nodes unchanged", () => {
    const before = [node(particle(2)), node({ ...particle(3), positionMode: "manual" })]
    const next = [{ ...before[0], position: { x: 200, y: 100 } }, before[1]]
    const midway = particleNodeTransition(before, next, 0.5)
    expect(midway[0].position).toEqual({ x: 100, y: 50 })
    expect(midway[1]).toBe(next[1])
    expect(particleNodeTransition(before, next, 1)[0].position).toEqual(next[0].position)
  })
  it("makes exiting cards inert before removing them", () => {
    const before = [node(particle(2))]
    const exit = particleNodeTransition(before, [], 0.25)[0]
    expect(exit.data).toMatchObject({ editable: false, exiting: true })
    expect(exit).toMatchObject({ draggable: false, focusable: false, connectable: false })
    expect(exit.style?.opacity).toBe(0.5)
    expect(particleNodeTransition(before, [], 1)).toEqual([])
  })
})


describe("Inspection dimension motion", () => {
  it.each(["manual", "locked", "managed"])("interpolates personal dimensions without moving %s anchors", mode => {
    const item = { ...particle(2), positionMode: mode === "managed" ? "managed" as const : "manual" as const, locked: mode === "locked" }
    const before = { ...node(item), style: { width: 400, height: 192 } }
    const after = { ...before, data: { ...before.data, expanded: true }, style: { width: 560, height: 400 } }
    const middle = particleNodeTransition([before], [after], 0.5)[0]
    expect(middle.style).toEqual({ width: 480, height: 296 })
    expect(middle.position).toEqual(before.position)
    expect(middle.data.inspectionTransition).toEqual({ width: 560, height: 400 })
    expect(middle.data.particle).toBe(item)
    expect(particleNodeTransition([before], [after], 1)[0].data.inspectionTransition).toBeUndefined()
    const collapsed = particleNodeTransition([after], [before], 0.5)[0]
    expect(collapsed.style).toEqual({ width: 480, height: 296 })
    expect(collapsed.data.inspectionTransition).toEqual({ width: 560, height: 400 })
  })
  it("cancels queued animation writes after newer state takes ownership", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) })
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    const before = { ...node(particle(2)), style: { width: 400, height: 192 } }
    const after = { ...before, data: { ...before.data, expanded: true }, style: { width: 560, height: 400 } }
    const setNodes = vi.fn()
    const stop = animateParticleNodes([before], [after], setNodes, () => false)
    const queued = setNodes.mock.calls[0][0]
    stop?.()
    const newer = [{ ...after, position: { x: 900, y: 800 } }]
    expect(queued(newer)).toBe(newer)
    vi.unstubAllGlobals()
  })
})
