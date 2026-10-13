import { particleConnectionMenuItems } from "@/features/workspace-particles/lib/connection-menu"
import { particleConnectionsToFlow } from "@/features/workspace-particles/lib/particle-flow-adapters"
import {
  buildParticleLink,
  buildParticleInsertion,
} from "@/features/workspace-particles/lib/connection-editing"
import { describe, expect, it } from "vitest"
import {
  applyParticleBatch,
  particleSchema,
  isDecisionBranchActive,
  marqueeParticles,
  moveParticleSelection,
  selectParticle,
  type ParticleResult,
} from "@/features/workspace-particles"
import {
  batch,
  edge,
  graph,
  ID,
  NOW,
  particle,
} from "./fixtures/particle-fixtures"

function value<T>(result: ParticleResult<T>) {
  if (!result.ok) throw new Error(result.error)
  return result.value
}
const rename = (id: number, title: string, expectedRevision = 0) => ({
  kind: "put_particle" as const,
  particle: { ...particle(id, id === 1 ? "objective" : "activity"), title },
  expectedRevision,
})

describe("atomic Particle operations", () => {
  it("requires movement and locking to be separate so each operation remains undoable", async () => {
    expect(
      await applyParticleBatch(
        graph(),
        batch(100, [
          {
            kind: "put_particle",
            expectedRevision: 0,
            particle: {
              ...particle(2),
              locked: true,
              position: { x: 10, y: 20 },
            },
          },
        ]),
        NOW
      )
    ).toMatchObject({ ok: false, code: "locked" })
  })

  it("refuses a deletion whose inverse exceeds the request budget", async () => {
    const items = [1, 2].map((id) =>
      particleSchema.parse({
        ...particle(id, "calendar"),
        data: {
          entries: Array.from({ length: 60 }, (_, index) => ({
            id: ID(1000 + index),
            title: "Draft",
            channels: ["email"],
            contentType: "email",
            delivery: "manual",
            scheduledAt: null,
            publishedAt: null,
            content: "x".repeat(4900),
            cta: "",
            status: "draft",
            order: index,
          })),
        },
      })
    )
    const initial = graph(items)
    const result = await applyParticleBatch(
      initial,
      batch(
        100,
        items.map((item) => ({
          kind: "remove_particle",
          id: item.id,
          expectedRevision: 0,
        }))
      ),
      NOW
    )
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining("too large to undo"),
    })
    expect(initial.particles).toHaveLength(2)
  })

  it("undoes rewiring an existing edge through a newly created Particle", async () => {
    const initial = graph(undefined, [edge(10, 1, 2)])
    const changed = value(
      await applyParticleBatch(
        initial,
        batch(100, [
          {
            kind: "put_particle",
            particle: particle(3),
            expectedRevision: null,
          },
          {
            kind: "put_connection",
            connection: edge(10, 1, 3),
            expectedRevision: 0,
          },
        ]),
        NOW
      )
    )
    const undone = value(
      await applyParticleBatch(
        changed.graph,
        batch(101, changed.inverse, 1),
        NOW
      )
    )
    expect(undone.graph.particles).toHaveLength(2)
    expect(undone.graph.connections).toEqual([
      expect.objectContaining({ source: ID(1), target: ID(2) }),
    ])
  })
  it("rejects a stale managed layout even when individual records are unchanged", async () => {
    const result = await applyParticleBatch(
      graph(),
      batch(100, [
        {
          kind: "move_particles",
          mode: "managed",
          positions: [
            { id: ID(1), expectedRevision: 0, position: { x: 10, y: 10 } },
          ],
        },
      ]),
      NOW
    )
    expect(result).toMatchObject({ ok: false, code: "invalid" })
  })

  it("changes only the requested record and allows unrelated stale edits", async () => {
    const initial = graph()
    const first = value(
      await applyParticleBatch(initial, batch(100, [rename(1, "Goal")]), NOW)
    )
    expect(first.graph.particles[1]).toBe(initial.particles[1])
    const second = value(
      await applyParticleBatch(
        first.graph,
        batch(101, [rename(2, "Event")]),
        NOW
      )
    )
    expect(second.graph.particles.map((item) => item.title)).toEqual([
      "Goal",
      "Event",
    ])
    expect(
      await applyParticleBatch(
        second.graph,
        batch(102, [rename(1, "Old")]),
        NOW
      )
    ).toMatchObject({ ok: false, code: "conflict" })
  })
  it("fails the whole batch without mutating input", async () => {
    const initial = graph()
    const copy = structuredClone(initial)
    expect(
      await applyParticleBatch(
        initial,
        batch(100, [
          rename(1, "Changed"),
          { kind: "remove_particle", id: ID(9), expectedRevision: 0 },
        ]),
        NOW
      )
    ).toMatchObject({ ok: false })
    expect(initial).toEqual(copy)
  })
  it("supports conflict-aware inverse operations and redo", async () => {
    const first = value(
      await applyParticleBatch(graph(), batch(100, [rename(1, "Goal")]), NOW)
    )
    const second = value(
      await applyParticleBatch(
        first.graph,
        batch(101, [rename(2, "Event")]),
        NOW
      )
    )
    const undone = value(
      await applyParticleBatch(
        second.graph,
        batch(102, first.inverse, second.graph.revision),
        NOW
      )
    )
    expect(undone.graph.particles.map((item) => item.title)).toEqual([
      "Objective",
      "Event",
    ])
    const redone = value(
      await applyParticleBatch(
        undone.graph,
        batch(103, undone.inverse, undone.graph.revision),
        NOW
      )
    )
    expect(redone.graph.particles.map((item) => item.title)).toEqual([
      "Goal",
      "Event",
    ])
    const conflicting = value(
      await applyParticleBatch(
        first.graph,
        batch(104, [rename(1, "Collaborator", 1)], 1),
        NOW
      )
    )
    expect(
      await applyParticleBatch(
        conflicting.graph,
        batch(105, first.inverse, 2),
        NOW
      )
    ).toMatchObject({ ok: false, code: "conflict" })
  })
  it("deletes incident connections and restores them on undo", async () => {
    const initial = { ...graph(undefined, [edge(10, 1, 2)]), rootId: ID(1) }
    const removed = value(
      await applyParticleBatch(
        initial,
        batch(100, [
          { kind: "remove_particle", id: ID(1), expectedRevision: 0 },
        ]),
        NOW
      )
    )
    expect(removed.graph.connections).toEqual([])
    expect(removed.graph.rootId).toBeNull()
    const restored = value(
      await applyParticleBatch(
        removed.graph,
        batch(101, removed.inverse, 1),
        NOW
      )
    )
    expect(restored.graph.connections[0]).toMatchObject({
      source: ID(1),
      target: ID(2),
    })
    expect(restored.graph.rootId).toBe(ID(1))
  })
  it("does not silently delete relationships added by a collaborator", async () => {
    const first = value(
      await applyParticleBatch(
        graph(),
        batch(100, [
          {
            kind: "put_connection",
            connection: edge(10, 1, 2),
            expectedRevision: null,
          },
        ]),
        NOW
      )
    )
    expect(
      await applyParticleBatch(
        first.graph,
        batch(101, [
          { kind: "remove_particle", id: ID(1), expectedRevision: 0 },
        ]),
        NOW
      )
    ).toMatchObject({ ok: false, code: "conflict" })
  })
  it("deduplicates retries and rejects reused IDs with different content", async () => {
    const request = batch(100, [rename(1, "Goal")])
    const first = value(await applyParticleBatch(graph(), request, NOW))
    const replay = value(await applyParticleBatch(first.graph, request, NOW))
    expect(replay.replayed).toBe(true)
    expect(replay.graph.revision).toBe(1)
    expect(
      await applyParticleBatch(
        first.graph,
        batch(100, [rename(1, "Other")]),
        NOW
      )
    ).toMatchObject({ ok: false, code: "conflict" })
  })
  it("rejects an evicted retry instead of applying it again", async () => {
    let current = graph()
    const first = batch(100, [rename(1, "Goal")])
    current = value(await applyParticleBatch(current, first, NOW)).graph
    for (let i = 1; i <= 64; i += 1)
      current = value(
        await applyParticleBatch(
          current,
          batch(100 + i, [rename(1, `Goal ${i}`, i)], i),
          NOW
        )
      ).graph
    expect(current.receipts).toHaveLength(64)
    expect(await applyParticleBatch(current, first, NOW)).toMatchObject({
      ok: false,
      code: "conflict",
    })
  })
  it("moves a group atomically, preserves relative offsets, and rejects locked moves", async () => {
    const initial = graph([
      particle(1, "objective"),
      { ...particle(2), position: { x: 50, y: 25 } },
    ])
    const operation = moveParticleSelection(initial.particles, [ID(1), ID(2)], {
      x: 12,
      y: 9,
    })
    if (!operation) throw new Error("Expected movement")
    const moved = value(
      await applyParticleBatch(initial, batch(100, [operation]), NOW)
    )
    expect(moved.graph.particles.map((item) => item.position)).toEqual([
      { x: 12, y: 9 },
      { x: 62, y: 34 },
    ])
    expect(moved.inverse).toHaveLength(2)
    expect(
      await applyParticleBatch(
        {
          ...initial,
          particles: initial.particles.map((item) => ({
            ...item,
            locked: true,
          })),
        },
        batch(100, [operation]),
        NOW
      )
    ).toMatchObject({ ok: false, code: "locked" })
  })
  it("undoes a created connected branch without double-removing edges", async () => {
    const created = value(
      await applyParticleBatch(
        graph(),
        batch(100, [
          {
            kind: "put_particle",
            particle: particle(3),
            expectedRevision: null,
          },
          {
            kind: "put_connection",
            connection: edge(10, 1, 3),
            expectedRevision: null,
          },
        ]),
        NOW
      )
    )
    const undo = value(
      await applyParticleBatch(
        created.graph,
        batch(101, created.inverse, 1),
        NOW
      )
    )
    expect(undo.graph.particles).toHaveLength(2)
    expect(undo.graph.connections).toHaveLength(0)
  })
  it("selecting an outcome highlights only its branch", async () => {
    const decision = particle(1, "decision")
    if (decision.type !== "decision") throw new Error("Expected decision")
    const initial = graph(
      [decision, particle(2), particle(3)],
      [
        edge(10, 1, 2, {
          relationship: "decision_outcome",
          sourceHandle: "outcome:yes",
          outcome: "yes",
        }),
        edge(11, 1, 3, {
          relationship: "decision_outcome",
          sourceHandle: "outcome:no",
          outcome: "no",
        }),
      ]
    )
    const result = value(
      await applyParticleBatch(
        initial,
        batch(100, [
          {
            kind: "put_particle",
            expectedRevision: 0,
            particle: {
              ...decision,
              data: { ...decision.data, selectedOutcome: "yes" },
            },
          },
        ]),
        NOW
      )
    )
    expect(
      result.graph.connections.map((item) =>
        isDecisionBranchActive(result.graph, item)
      )
    ).toEqual([true, false])
  })
})

describe("selection contracts", () => {
  it("replaces, adds, toggles off and retains an ordinary selected click", () => {
    expect(selectParticle(["a"], "b", false)).toEqual(["b"])
    expect(selectParticle(["a"], "b", true)).toEqual(["a", "b"])
    expect(selectParticle(["a", "b"], "b", true)).toEqual(["a"])
    expect(selectParticle(["a"], "a", false)).toEqual(["a"])
    expect(selectParticle(["a", "b"], "a", false)).toEqual(["a", "b"])
  })
  it("supports reverse-direction and additive intersecting marquee", () => {
    const bounds = [
      { id: "a", x: 0, y: 0, width: 20, height: 20 },
      { id: "b", x: 100, y: 0, width: 20, height: 20 },
    ]
    expect(
      marqueeParticles(bounds, { x: 15, y: 15 }, { x: -10, y: -10 })
    ).toEqual(["a"])
    expect(
      marqueeParticles(bounds, { x: 15, y: 15 }, { x: -10, y: -10 }, ["b"])
    ).toEqual(["b", "a"])
  })
})

describe("interactive connection editing", () => {
  it("validates normal handles and rejects duplicates, hidden endpoints and hierarchy cycles", () => {
    const input = graph(undefined, [edge(10, 1, 2)])
    expect(
      buildParticleLink(input, { source: ID(1), target: ID(2) }, ID(11))
    ).toMatchObject({ ok: false })
    expect(
      buildParticleLink(input, { source: ID(2), target: ID(1) }, ID(11))
    ).toMatchObject({ ok: false })
    expect(
      buildParticleLink(
        input,
        { source: ID(2), target: ID(1), relationship: "feedback" },
        ID(11)
      )
    ).toMatchObject({ ok: true })
    expect(
      buildParticleLink(
        graph(),
        { source: ID(1), target: ID(2), targetHandle: "wrong" },
        ID(11)
      )
    ).toMatchObject({ ok: false })
    expect(
      buildParticleLink(
        graph([particle(1), { ...particle(2), canvasHidden: true }]),
        { source: ID(1), target: ID(2) },
        ID(11)
      )
    ).toMatchObject({ ok: false })
    expect(
      buildParticleLink(
        graph(),
        { source: "legacy-card", target: ID(2) },
        ID(11)
      )
    ).toMatchObject({ ok: false })
  })
  it("normalizes omitted handles while retaining explicit relationship semantics", () => {
    for (const relationship of [
      "dependency",
      "sequence",
      "related_resource",
      "feedback",
    ] as const) {
      const result = buildParticleLink(
        graph(),
        { source: ID(1), target: ID(2), relationship },
        ID(10)
      )
      expect(result).toMatchObject({
        ok: true,
        value: { relationship, sourceHandle: "out", targetHandle: "in" },
      })
    }
    expect(
      buildParticleLink(graph(), { source: ID(1), target: ID(1) }, ID(10))
    ).toMatchObject({ ok: false })
    expect(
      buildParticleLink(
        graph(),
        { source: ID(1), target: ID(1), relationship: "feedback" },
        ID(10)
      )
    ).toMatchObject({ ok: true })
  })
  it("infers a declared decision outcome without changing the decision's result or criteria", () => {
    const input = graph([particle(1, "decision"), particle(2)])
    const original = structuredClone(input)
    expect(
      buildParticleLink(
        input,
        { source: ID(1), target: ID(2), sourceHandle: "outcome:yes" },
        ID(10)
      )
    ).toMatchObject({
      ok: true,
      value: { relationship: "decision_outcome", outcome: "yes" },
    })
    expect(
      buildParticleLink(
        input,
        { source: ID(1), target: ID(2), sourceHandle: "outcome:unknown" },
        ID(10)
      )
    ).toMatchObject({ ok: false })
    expect(
      buildParticleLink(
        input,
        {
          source: ID(1),
          target: ID(2),
          sourceHandle: "outcome:yes",
          relationship: "dependency",
        },
        ID(10)
      )
    ).toMatchObject({ ok: false })
    expect(input).toEqual(original)
  })
  it("splits a decision branch atomically, keeps its identity/outcome and restores it through undo", async () => {
    const input = graph(
      [particle(1, "decision"), particle(2)],
      [
        edge(10, 1, 2, {
          sourceHandle: "outcome:yes",
          relationship: "decision_outcome",
          outcome: "yes",
        }),
      ]
    )
    const insertion = buildParticleInsertion(input, ID(10), {
      id: ID(3),
      linkId: ID(11),
      type: "activity",
      now: NOW,
      position: { x: 500, y: 600 },
    })
    if (!insertion.ok) throw new Error(insertion.error)
    expect(insertion.value).toHaveLength(3)
    const committed = value(
      await applyParticleBatch(
        input,
        { ...batch(100, insertion.value), requireExactRevision: true },
        NOW
      )
    )
    expect(committed.graph.particles).toHaveLength(3)
    expect(committed.graph.connections).toHaveLength(2)
    expect(
      committed.graph.connections.find((item) => item.id === ID(10))
    ).toMatchObject({
      source: ID(1),
      target: ID(3),
      sourceHandle: "outcome:yes",
      outcome: "yes",
    })
    expect(
      committed.graph.connections.find((item) => item.id === ID(11))
    ).toMatchObject({ source: ID(3), target: ID(2), relationship: "sequence" })
    expect(committed.graph.particles.slice(0, 2)).toEqual(input.particles)
    const undone = value(
      await applyParticleBatch(
        committed.graph,
        {
          ...batch(101, committed.inverse, committed.graph.revision),
          requireExactRevision: true,
        },
        NOW
      )
    )
    expect(undone.graph.particles).toEqual(input.particles)
    expect(undone.graph.connections).toHaveLength(1)
    expect(undone.graph.connections[0]).toMatchObject({
      ...input.connections[0],
      revision: undone.graph.revision,
    })
  })
  it("rejects insertion into resource/feedback links and hidden records", () => {
    const options = {
      id: ID(3),
      linkId: ID(11),
      type: "activity" as const,
      now: NOW,
      position: { x: 100, y: 100 },
    }
    for (const relationship of ["related_resource", "feedback"] as const) {
      expect(
        buildParticleInsertion(
          graph(undefined, [edge(10, 1, 2, { relationship })]),
          ID(10),
          options
        )
      ).toMatchObject({ ok: false })
    }
    expect(
      buildParticleInsertion(
        graph(
          [{ ...particle(1), canvasHidden: true }, particle(2)],
          [edge(10, 1, 2)]
        ),
        ID(10),
        options
      )
    ).toMatchObject({ ok: false })
    expect(
      buildParticleInsertion(graph(undefined, [edge(10, 1, 2)]), ID(10), {
        ...options,
        id: ID(1),
      })
    ).toMatchObject({ ok: false })
  })
  it("rejects stale insertion as a whole instead of creating an orphan Activity", async () => {
    const input = graph(undefined, [edge(10, 1, 2)])
    const insertion = buildParticleInsertion(input, ID(10), {
      id: ID(3),
      linkId: ID(11),
      type: "activity",
      now: NOW,
      position: { x: 100, y: 100 },
    })
    if (!insertion.ok) throw new Error(insertion.error)
    const concurrent = value(
      await applyParticleBatch(
        input,
        batch(90, [
          { kind: "remove_connection", id: ID(10), expectedRevision: 0 },
        ]),
        NOW
      )
    )
    const result = await applyParticleBatch(
      concurrent.graph,
      { ...batch(100, insertion.value), requireExactRevision: true },
      NOW
    )
    expect(result).toMatchObject({ ok: false, code: "conflict" })
    expect(concurrent.graph.particles).toHaveLength(2)
    expect(concurrent.graph.connections).toHaveLength(0)
  })
})

describe("existing workspace tool resource links", () => {
  it("persists and reverses links in both directions without cloning tool records", async () => {
    for (const tool of [
      "organization-overview",
      "programs",
      "fiscal-sponsorship",
    ]) {
      for (const input of [
        { source: ID(1), target: tool },
        { source: tool, target: ID(1) },
      ]) {
        const initial = graph()
        const built = value(buildParticleLink(initial, input, ID(10), [tool]))
        expect(built.relationship).toBe("related_resource")
        const saved = value(
          await applyParticleBatch(
            initial,
            batch(100, [
              {
                kind: "put_connection",
                connection: built,
                expectedRevision: null,
              },
            ]),
            NOW
          )
        )
        expect(saved.graph.particles).toEqual(initial.particles)
        expect(particleConnectionsToFlow(saved.graph, [], [tool])).toHaveLength(
          1
        )
        expect(particleConnectionsToFlow(saved.graph, [], [])).toEqual([])
        expect(
          particleConnectionsToFlow(saved.graph, [], [tool])[0]
        ).toMatchObject(input)
        const undone = value(
          await applyParticleBatch(
            saved.graph,
            batch(101, saved.inverse, saved.graph.revision),
            NOW
          )
        )
        expect(undone.graph.connections).toEqual([])
      }
    }
  })

  it("rejects hidden/unknown tools, hierarchy or outcome bridges and wrong handle kinds", () => {
    const initial = graph()
    const tools = ["organization-overview"]
    const link = { source: ID(1), target: tools[0] }
    expect(buildParticleLink(initial, link, ID(10)).ok).toBe(false)
    expect(
      buildParticleLink(initial, { ...link, target: "documents" }, ID(10), [
        "documents",
      ]).ok
    ).toBe(false)
    expect(
      buildParticleLink(
        initial,
        { ...link, relationship: "dependency" },
        ID(10),
        tools
      ).ok
    ).toBe(false)
    expect(
      buildParticleLink(
        initial,
        { ...link, sourceHandle: "outcome:yes" },
        ID(10),
        tools
      ).ok
    ).toBe(false)
    expect(
      buildParticleLink(initial, { ...link, targetHandle: "in" }, ID(10), tools)
        .ok
    ).toBe(false)
    expect(
      buildParticleLink(
        initial,
        { source: tools[0], target: "fiscal-sponsorship" },
        ID(10),
        [...tools, "fiscal-sponsorship"]
      ).ok
    ).toBe(false)
    const built = value(buildParticleLink(initial, link, ID(10), tools))
    expect(
      buildParticleLink(
        { ...initial, connections: [built] },
        link,
        ID(11),
        tools
      ).ok
    ).toBe(false)
  })
})

it("lists the clicked connection first and only related links with revision-safe named choices", () => {
  const input = graph(
    [particle(1), particle(2), particle(3), particle(4)],
    [
      edge(10, 1, 2),
      edge(11, 2, 3),
      edge(12, 3, 4),
      edge(13, 1, 4, {
        target: "fiscal-sponsorship",
        targetHandle: "workspace-card-target-left",
        relationship: "related_resource",
        revision: 7,
      }),
    ]
  )
  const choices = particleConnectionMenuItems(input, ID(13))
  expect(choices.map((item) => item.id)).toEqual([ID(13), ID(10)])
  expect(choices[0]).toMatchObject({
    revision: 7,
    clicked: true,
    detail: "Related resource",
  })
  expect(choices[0].label).toContain("Fiscal Sponsorship")
  expect(particleConnectionMenuItems(input, ID(999))).toEqual([])
})
