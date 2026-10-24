import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { useParticleSession, type ParticleSession, type ParticleTransport } from "@/features/workspace-particles/hooks/use-particle-session"
import { usePersonPlacements } from "@/features/workspace-particles/hooks/use-person-placements"
import {
  applyParticleBatch, particleSchema, readParticleGraph, placeParticle,
  planPersonPlacements, planLocalPersonPlacementRecovery, personPlacements,
  type ParticleGraph, type ParticleResult, type PersonPlacement,
} from "@/features/workspace-particles"
import { batch, edge, graph, ID, NOW, particle } from "./fixtures/particle-fixtures"

function value<T>(result: ParticleResult<T>): T {
  if (!result.ok) throw new Error(result.error)
  return result.value
}
const placement = (id = 701, x = 10): PersonPlacement => ({ personId: ID(id), position: { x, y: 20 } })
function plan(current: ParticleGraph = graph(), placements = [placement()], id = 70) {
  let nextId = id
  return value(planPersonPlacements({ graph: current, placements, uuid: () => ID(nextId++), now: NOW }))
}
async function add() {
  return value(await applyParticleBatch(graph(), batch(100, plan()), NOW)).graph
}

describe("shared person placement commands", () => {
  it("stores only the source ID and position, keeping legacy group People compatible", async () => {
    const current = await add()
    const item = personPlacements(current).get(ID(701))!
    expect(item).toMatchObject({ id: ID(70), title: "Person", position: { x: 10, y: 20 }, positionMode: "manual" })
    expect(item.data).toEqual({ presentation: "person", personIds: [ID(701)], segment: "" })
    expect(readParticleGraph(current, current.workspaceId).ok).toBe(true)
    expect(particleSchema.safeParse(particle(5, "people")).success).toBe(true)
    for (const personIds of [[], [ID(701), ID(702)]])
      expect(particleSchema.safeParse({ ...item, data: { ...item.data, personIds } }).success).toBe(false)
  })
  it("makes repeated Add/drop a no-op without resetting an existing position", async () => {
    const current = await add()
    expect(plan(current, [placement(701, 900)])).toEqual([])
    expect(personPlacements(current).get(ID(701))?.position.x).toBe(10)
  })
  it("hides and re-adds the same record while retaining its connections and lock policy", async () => {
    const current = { ...await add(), connections: [edge(80, 1, 70, { revision: 1, relationship: "related_resource" })] }
    const before = personPlacements(current).get(ID(701))!
    const hidden = value(await applyParticleBatch(current, batch(101, [{
      kind: "put_particle", particle: { ...placeParticle(before, false), locked: true }, expectedRevision: before.revision,
    }], current.revision), NOW)).graph
    const readded = value(await applyParticleBatch(hidden, batch(102, plan(hidden, [placement(701, 900)]), hidden.revision), NOW)).graph
    expect(personPlacements(readded).get(ID(701))).toMatchObject({ id: before.id, locked: true, canvasHidden: false, position: before.position })
    expect(readded.particles).toHaveLength(current.particles.length)
    expect(readded.connections).toEqual(current.connections)
  })
  it("uses existing atomic revisions and inverses for movement, undo and redo", async () => {
    const current = await add()
    const moved = value(await applyParticleBatch(current, batch(101, [{ kind: "move_particles", mode: "manual", positions: [
      { id: ID(70), expectedRevision: 1, position: { x: 240, y: 80 } },
    ] }], current.revision), NOW))
    expect(personPlacements(moved.graph).get(ID(701))?.position).toEqual({ x: 240, y: 80 })
    const undone = value(await applyParticleBatch(moved.graph, batch(102, moved.inverse, moved.graph.revision), NOW))
    expect(personPlacements(undone.graph).get(ID(701))?.position).toEqual({ x: 10, y: 20 })
    const redone = value(await applyParticleBatch(undone.graph, batch(103, undone.inverse, undone.graph.revision), NOW))
    expect(personPlacements(redone.graph).get(ID(701))?.position).toEqual({ x: 240, y: 80 })
    expect(await applyParticleBatch(moved.graph, batch(104, moved.inverse.map(op => op.kind === "put_particle" ? { ...op, expectedRevision: 1 } : op), 1), NOW))
      .toMatchObject({ ok: false, code: "conflict" })
  })
  it("rejects racing duplicate adds and replay does not create another placement", async () => {
    const request = batch(100, plan())
    const first = value(await applyParticleBatch(graph(), request, NOW))
    expect(await applyParticleBatch(first.graph, request, NOW)).toMatchObject({ ok: true, value: { replayed: true } })
    const race = batch(101, plan(graph(), [placement()], 71))
    expect(await applyParticleBatch(first.graph, race, NOW)).toMatchObject({ ok: false, code: "invalid" })
    expect(personPlacements(first.graph).size).toBe(1)
  })
  it("rejects malformed/duplicate inputs and capacity overflow without returning a partial batch", () => {
    const input = { graph: graph(), placements: [placement()], uuid: () => ID(70), now: NOW }
    for (const placements of [[placement(), placement()], [placement(701, Number.NaN)], [placement(701, 1_000_001)]])
      expect(planPersonPlacements({ ...input, placements })).toMatchObject({ ok: false, code: "invalid" })
    expect(planPersonPlacements({ ...input, uuid: () => ID(1) })).toMatchObject({ ok: false })
    expect(planPersonPlacements({ ...input, placements: [placement(), placement(702)] })).toMatchObject({ ok: false })
    expect(planPersonPlacements({ ...input, graph: graph(Array.from({ length: 250 }, (_, i) => particle(i + 1))) })).toMatchObject({ ok: false })
  })
})

describe("local person position recovery", () => {
  it("imports missing known people but preserves visible and intentionally hidden shared placements", async () => {
    const current = await add()
    const before = personPlacements(current).get(ID(701))!
    const hidden = { ...current, particles: current.particles.map(item => item.id === before.id ? placeParticle(item, false) : item) }
    const local = [placement(701, 999), placement(702, -200), placement(702, 99), placement(703)]
    const original = structuredClone(local)
    for (const state of [current, hidden]) {
      const input = { graph: state, placements: local, availablePersonIds: new Set([ID(701), ID(702)]), uuid: () => ID(71), now: NOW }
      const operations = value(planLocalPersonPlacementRecovery(input))
      expect(operations).toHaveLength(1)
      const next = value(await applyParticleBatch(state, batch(110, operations, state.revision), NOW)).graph
      expect(personPlacements(next).get(ID(701))).toEqual(personPlacements(state).get(ID(701)))
      expect(personPlacements(next).get(ID(702))?.position).toEqual({ x: -200, y: 20 })
      expect(value(planLocalPersonPlacementRecovery({ ...input, graph: next }))).toEqual([])
    }
    expect(local).toEqual(original)
  })
})


function sharedSessionHarness(canEdit = true) {
  let stored = graph()
  const transport = vi.fn<ParticleTransport>(async (request) => {
    const result = await applyParticleBatch(stored, request, NOW)
    if (result.ok) stored = result.value.graph
    return result
  })
  let session: ParticleSession | undefined
  let people: ReturnType<typeof usePersonPlacements> | undefined
  function Harness() {
    session = useParticleSession({ workspaceId: stored.workspaceId, stored, canEdit, transport,
      load: async () => ({ ok: true, value: stored }),
    })
    people = usePersonPlacements(session)
    return null
  }
  renderToStaticMarkup(createElement(Harness))
  if (!session || !people) throw new Error("Missing shared session")
  return { session, people, transport, persisted: () => stored }
}

describe("person controls share the Particle mutation session", () => {
  it("interleaves People and other Particle edits in a single undo/redo history", async () => {
    const { session, people, persisted } = sharedSessionHarness()
    expect(await people.add([placement()])).toBe(true)
    const added = personPlacements(persisted()).get(ID(701))!
    const objective = persisted().particles[0]
    expect(await session.edit({ ...objective, title: "Updated objective" })).toBe(true)
    expect(await people.remove(ID(701))).toBe(true)
    expect(personPlacements(persisted()).get(ID(701))?.canvasHidden).toBe(true)
    expect(await session.travel("undo")).toBe(true)
    expect(personPlacements(persisted()).get(ID(701))).toMatchObject({ id: added.id, data: added.data, position: added.position })
    expect(personPlacements(persisted()).get(ID(701))?.canvasHidden).not.toBe(true)
    expect(persisted().particles[0].title).toBe("Updated objective")
    expect(await session.travel("undo")).toBe(true)
    expect(persisted().particles[0].title).toBe(objective.title)
    expect(await session.travel("undo")).toBe(true)
    expect(personPlacements(persisted()).has(ID(701))).toBe(false)
    expect(await session.travel("redo")).toBe(true)
    expect(personPlacements(persisted()).get(ID(701))?.id).toBe(added.id)
  })

  it("retains one ID on remove/re-add and repeated Add does not reset position or save", async () => {
    const { people, persisted, transport } = sharedSessionHarness()
    expect(await people.add([placement()])).toBe(true)
    const original = personPlacements(persisted()).get(ID(701))!
    expect(await people.add([placement(701, 500)])).toBe(true)
    expect(transport).toHaveBeenCalledTimes(1)
    expect(personPlacements(persisted()).get(ID(701))?.position.x).toBe(10)
    expect(await people.remove(ID(701))).toBe(true)
    expect(await people.remove(ID(701))).toBe(true)
    expect(transport).toHaveBeenCalledTimes(2)
    expect(await people.add([placement(701, 500)])).toBe(true)
    expect(personPlacements(persisted()).get(ID(701))).toMatchObject({
      id: original.id, canvasHidden: false, position: { x: 500, y: 20 },
    })
  })

  it("retries a failed People save through the same session with the exact original IDs", async () => {
    const { session, people, transport, persisted } = sharedSessionHarness()
    transport.mockImplementationOnce(async () => ({ ok: false, code: "unavailable", error: "Offline" }))
    expect(await people.add([placement()])).toBe(false)
    expect(personPlacements(persisted()).size).toBe(0)
    const failed = transport.mock.calls[0][0]
    expect(await session.edit({ ...persisted().particles[0], title: "Blocked while unresolved" })).toBe(false)
    expect(await session.retry()).toBe(true)
    expect(transport.mock.calls[1][0]).toEqual(failed)
    expect(personPlacements(persisted()).size).toBe(1)
    expect(await people.add([placement()])).toBe(true)
    expect(transport).toHaveBeenCalledTimes(2)
  })

  it("rejects read-only controls and invalid placements before sending", async () => {
    const readOnly = sharedSessionHarness(false)
    expect(await readOnly.people.add([placement()])).toBe(false)
    expect(await readOnly.people.remove(ID(701))).toBe(false)
    expect(readOnly.transport).not.toHaveBeenCalled()
    const editor = sharedSessionHarness()
    expect(await editor.people.add([placement(701, Number.NaN)])).toBe(false)
    expect(editor.transport).not.toHaveBeenCalled()
  })
})
