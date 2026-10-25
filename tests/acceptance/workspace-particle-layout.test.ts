import { afterEach, describe, expect, it, vi } from "vitest"
import { Position, type InternalNode, type Node } from "@xyflow/react"
import { captureParticleScene } from "@/features/workspace-particles/lib/layout-measurements"
import {
  layoutParticleScene,
  particleSceneKey,
  routeParticleScene,
} from "@/features/workspace-particles/lib/layout-scene"
import { runParticleWorker } from "@/features/workspace-particles/lib/layout-worker-client"
import { applyParticleBatch } from "@/features/workspace-particles"
import {
  createParticleLayoutCoordinator,
  layoutParticleGraph,
  particleLayoutBatch,
  roundedParticleRoute,
  segmentCrossesParticle,
  type ParticleType,
} from "@/features/workspace-particles"
import {
  edge,
  graph,
  ID,
  measurements,
  particle,
  NOW,
} from "./fixtures/particle-fixtures"

function proofGraph() {
  const types: ParticleType[] = [
    "objective",
    "activity",
    "calendar",
    "decision",
    "people",
    "workflow",
    "metric",
    "decision",
    "finance",
  ]
  const items = Array.from({ length: 30 }, (_, index) =>
    particle(index + 1, types[index] ?? "activity")
  )
  const edges = [
    edge(101, 1, 2),
    edge(102, 1, 3),
    edge(103, 2, 4),
    edge(104, 4, 5, {
      relationship: "decision_outcome",
      outcome: "yes",
      sourceHandle: "outcome:yes",
    }),
    edge(105, 4, 6, {
      relationship: "decision_outcome",
      outcome: "no",
      sourceHandle: "outcome:no",
    }),
    edge(106, 5, 7),
    edge(107, 6, 7),
    edge(108, 7, 8),
    edge(109, 8, 9, {
      relationship: "decision_outcome",
      outcome: "yes",
      sourceHandle: "outcome:yes",
    }),
    edge(110, 8, 10, {
      relationship: "decision_outcome",
      outcome: "no",
      sourceHandle: "outcome:no",
    }),
    edge(111, 9, 11),
    edge(112, 10, 11),
    ...Array.from({ length: 18 }, (_, index) =>
      edge(120 + index, 11 + index, 12 + index)
    ),
    edge(180, 29, 4, { relationship: "feedback" }),
    edge(181, 3, 9, { relationship: "related_resource" }),
  ]
  return { ...graph(items, edges), rootId: ID(1) }
}

describe("measured Particle layout", () => {
  it("lays out 30 varied Particles, splits, convergence, detached work and feedback using real ELK", async () => {
    const input = proofGraph()
    const sizes = measurements(input)
    const result = await layoutParticleGraph({
      graph: input,
      measurements: sizes,
    })
    if (!result.ok) throw new Error(result.error)
    expect(result.value.nodes).toHaveLength(30)
    expect(result.value.routes).toHaveLength(input.connections.length)
    const positions = new Map(result.value.nodes.map((node) => [node.id, node]))
    expect(positions.get(ID(4))!.x).toBeLessThan(positions.get(ID(5))!.x)
    expect(positions.get(ID(5))!.y).not.toBe(positions.get(ID(6))!.y)
    expect(positions.get(ID(5))!.x).toBeLessThan(positions.get(ID(7))!.x)
    for (const route of result.value.routes) {
      for (let i = 1; i < route.points.length; i += 1) {
        expect(
          result.value.nodes.some((node) =>
            segmentCrossesParticle(route.points[i - 1], route.points[i], node)
          )
        ).toBe(false)
      }
    }
    expect(input.particles.every((item) => item.position.x === 0)).toBe(true)
    const repeated = await layoutParticleGraph({
      graph: {
        ...input,
        particles: [...input.particles].reverse(),
        connections: [...input.connections].reverse(),
      },
      measurements: [...sizes].reverse(),
    })
    expect(repeated).toEqual(result)
  }, 20000)
  it("uses actual heights and only creates an explicit revision-checked layout operation", async () => {
    const input = graph(undefined, [edge(10, 1, 2)])
    const sizes = measurements(input)
    sizes[0].height = 850
    const result = await layoutParticleGraph({
      graph: input,
      measurements: sizes,
    })
    if (!result.ok) throw new Error(result.error)
    expect(result.value.nodes[0].height).toBe(850)
    expect(
      particleLayoutBatch(input, sizes, result.value, ID(100))
    ).toMatchObject({
      ok: true,
      value: {
        requireExactRevision: true,
        operations: [{ kind: "move_particles", mode: "managed" }],
      },
    })
    expect(
      particleLayoutBatch(
        { ...input, revision: 1 },
        sizes,
        result.value,
        ID(100)
      )
    ).toMatchObject({ ok: false, code: "conflict" })
    expect(
      particleLayoutBatch(
        input,
        sizes.map((item) => ({ ...item, height: item.height + 1 })),
        result.value,
        ID(100)
      )
    ).toMatchObject({ ok: false, code: "conflict" })
  })
  it("refuses missing measurements and unsupported locked constraints without moving data", async () => {
    const input = graph()
    expect(
      await layoutParticleGraph({ graph: input, measurements: [] })
    ).toMatchObject({ ok: false, code: "invalid" })
    const locked = {
      ...input,
      particles: input.particles.map((item) => ({ ...item, locked: true })),
    }
    expect(
      await layoutParticleGraph({
        graph: locked,
        measurements: measurements(input),
      })
    ).toMatchObject({ ok: false, code: "locked" })
    expect(locked.particles[0].position).toEqual({ x: 0, y: 0 })
  })
  it("rejects missing routes or invalid coordinates from a runner", async () => {
    const input = graph(undefined, [edge(10, 1, 2)])
    expect(
      await layoutParticleGraph(
        { graph: input, measurements: measurements(input) },
        async () => ({ id: "bad", children: [] })
      )
    ).toMatchObject({ ok: false, code: "unavailable" })
  })
  it("cancels even when a runner never resolves", async () => {
    const coordinator = createParticleLayoutCoordinator(
      () => new Promise(() => {})
    )
    const input = graph()
    const pending = coordinator.run({
      graph: input,
      measurements: measurements(input),
    })
    coordinator.cancel()
    expect(await pending).toMatchObject({ ok: false })
  })
  it("generates rounded orthogonal paths without another canvas or SVG overlay", () => {
    expect(
      roundedParticleRoute(
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
        ],
        4
      )
    ).toBe("M 0 0 L 16 0 Q 20 0 20 4 L 20 20")
  })
})

function sceneFixture() {
  const input = graph(
    [
      { ...particle(1, "objective"), locked: true },
      particle(2),
      particle(3),
      { ...particle(4), canvasHidden: true },
    ],
    [edge(10, 1, 2), edge(11, 2, 3)]
  )
  return {
    graph: input,
    measurements: measurements(input).filter((item) => item.id !== ID(4)),
    obstacles: [{ id: "organization", x: 500, y: 0, width: 672, height: 560 }],
  }
}

describe("live layout scene safety", () => {
  it("keeps locked, hidden and legacy cards fixed while arranging a measured subgraph", async () => {
    const scene = sceneFixture()
    const before = structuredClone(scene)
    const result = await layoutParticleScene({
      scene,
      scopeIds: [ID(2), ID(3)],
    })
    if (!result.ok) throw new Error(result.error)
    expect(result.value.nodes.map((item) => item.id).sort()).toEqual([
      ID(2),
      ID(3),
    ])
    expect(result.value.nodes.every((item) => item.x >= 1284)).toBe(true)
    expect(result.value.routes).toHaveLength(2)
    expect(scene).toEqual(before)
    const operation = particleLayoutBatch(
      scene.graph,
      scene.measurements,
      result.value,
      ID(100),
      [ID(2), ID(3)]
    )
    if (!operation.ok) throw new Error(operation.error)
    const committed = await applyParticleBatch(
      scene.graph,
      operation.value,
      NOW
    )
    if (!committed.ok) throw new Error(committed.error)
    expect(
      committed.value.graph.particles.find((item) => item.id === ID(1))
    ).toEqual(scene.graph.particles[0])
    expect(
      committed.value.graph.particles.find((item) => item.id === ID(4))
    ).toEqual(scene.graph.particles[3])
    expect(committed.value.graph.connections).toEqual(scene.graph.connections)
    const undone = await applyParticleBatch(
      committed.value.graph,
      {
        id: ID(101),
        workspaceId: scene.graph.workspaceId,
        baseRevision: committed.value.graph.revision,
        requireExactRevision: true,
        operations: committed.value.inverse,
      },
      NOW
    )
    if (!undone.ok) throw new Error(undone.error)
    expect(undone.value.graph.particles.map((item) => item.position)).toEqual(
      scene.graph.particles.map((item) => item.position)
    )
  })
  it("validates full records before arranging a subset with references outside the selection", async () => {
    const referenced = particle(2)
    if (referenced.type !== "activity") throw new Error("fixture")
    referenced.data.steps = [
      {
        id: ID(50),
        title: "Use the other activity",
        status: "backlog",
        order: 0,
        particleId: ID(3),
      },
    ]
    const input = graph([referenced, particle(3)])
    const result = await layoutParticleScene({
      scene: { graph: input, measurements: measurements(input), obstacles: [] },
      scopeIds: [ID(2)],
    })
    expect(result).toMatchObject({
      ok: true,
      value: { nodes: [{ id: ID(2) }] },
    })
  })
  it.each([[ID(1)], [ID(4)], [ID(2), ID(2)], [ID(99)], []])(
    "rejects invalid scope %j",
    async (...ids) => {
      const result = await layoutParticleScene({
        scene: sceneFixture(),
        scopeIds: ids,
      })
      expect(result).toMatchObject({ ok: false, code: "invalid" })
    }
  )
  it("fences changed legacy geometry and manual positions, independent of graph revision", () => {
    const scene = sceneFixture()
    const key = particleSceneKey(scene)
    scene.obstacles[0].height += 1
    expect(particleSceneKey(scene)).not.toBe(key)
    const next = particleSceneKey(scene)
    scene.graph.particles[1].position.x += 1
    expect(particleSceneKey(scene)).not.toBe(next)
  })
  it("routes saved geometry without changing positions or rerunning layout", async () => {
    const scene = sceneFixture()
    const result = await layoutParticleScene({
      scene,
      scopeIds: [ID(2), ID(3)],
    })
    if (!result.ok) throw new Error(result.error)
    scene.graph.particles = scene.graph.particles.map((item) => {
      const placed = result.value.nodes.find((node) => node.id === item.id)
      return placed ? { ...item, position: { x: placed.x, y: placed.y } } : item
    })
    const before = structuredClone(scene)
    const routes = routeParticleScene(scene)
    expect(routes.ok).toBe(true)
    expect(scene).toEqual(before)
    expect(routeParticleScene({ ...scene, measurements: [] })).toMatchObject({
      ok: false,
    })
  })
  it("rejects a scoped batch that does not exactly cover its requested selection", async () => {
    const scene = sceneFixture()
    const result = await layoutParticleScene({
      scene,
      scopeIds: [ID(2), ID(3)],
    })
    if (!result.ok) throw new Error(result.error)
    expect(
      particleLayoutBatch(
        scene.graph,
        scene.measurements,
        result.value,
        ID(100),
        [ID(2)]
      )
    ).toMatchObject({ ok: false })
    expect(
      particleLayoutBatch(
        scene.graph,
        scene.measurements,
        result.value,
        ID(100),
        [ID(2), ID(2)]
      )
    ).toMatchObject({ ok: false })
  })
})

function measuredFlow(input = graph()) {
  const sizes = measurements(input)
  const nodes: Node[] = input.particles.map((item, index) => ({
    id: item.id,
    position: item.position,
    data: {},
    measured: sizes[index],
  }))
  const internals: InternalNode[] = nodes.map((node, index) => ({
    ...node,
    measured: node.measured ?? {},
    internals: {
      positionAbsolute: node.position,
      z: 0,
      userNode: node,
      handleBounds: {
        target: [
          {
            id: "in",
            nodeId: node.id,
            type: "target",
            position: Position.Left,
            x: -4,
            y: sizes[index].height / 2 - 4,
            width: 8,
            height: 8,
          },
        ],
        source: [
          {
            id: "out",
            nodeId: node.id,
            type: "source",
            position: Position.Right,
            x: sizes[index].width - 4,
            y: sizes[index].height / 2 - 4,
            width: 8,
            height: 8,
          },
        ],
      },
    },
  }))
  return {
    nodes,
    internals,
    getNodes: () => nodes,
    getInternalNode: (id: string) => internals.find((node) => node.id === id),
  }
}

describe("fixed dependency direction", () => {
  it("moves a selection vertically when moving right would reverse a dependency", async () => {
    const input = graph(
      [
        { ...particle(1, "objective"), position: { x: 0, y: 0 } },
        { ...particle(2), position: { x: 400, y: 0 } },
        { ...particle(3), position: { x: 1200, y: 0 } },
      ],
      [edge(10, 1, 2), edge(11, 2, 3)]
    )
    const result = await layoutParticleScene({
      scene: {
        graph: input,
        measurements: measurements(input),
        obstacles: [
          { id: "organization", x: 400, y: 0, width: 700, height: 500 },
        ],
      },
      scopeIds: [ID(2)],
    })
    if (!result.ok) throw new Error(result.error)
    expect(result.value.nodes[0].x).toBeGreaterThanOrEqual(392)
    expect(
      result.value.nodes[0].x + result.value.nodes[0].width
    ).toBeLessThanOrEqual(1088)
    expect(result.value.nodes[0].y).toBeGreaterThan(500)
  })
  it("refuses impossible fixed dependencies rather than reversing their direction", async () => {
    const input = graph(
      [
        { ...particle(1, "objective"), position: { x: 0, y: 0 } },
        particle(2),
        { ...particle(3), position: { x: 400, y: 0 } },
      ],
      [edge(10, 1, 2), edge(11, 2, 3)]
    )
    expect(
      await layoutParticleScene({
        scene: {
          graph: input,
          measurements: measurements(input),
          obstacles: [],
        },
        scopeIds: [ID(2)],
      })
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("fixed dependencies"),
    })
  })
})

describe("React Flow measurement boundary", () => {
  it("uses measured sizes and handle centers without estimated heights", () => {
    const input = graph()
    const flow = measuredFlow(input)
    const result = captureParticleScene(input, flow)
    expect(result).toMatchObject({
      ok: true,
      value: { measurements: measurements(input) },
    })
    flow.internals[0].measured = {}
    expect(captureParticleScene(input, flow)).toMatchObject({ ok: false })
  })
  it("rejects dragging, missing cards and unmeasured handles", () => {
    const input = graph()
    const flow = measuredFlow(input)
    flow.nodes[0].dragging = true
    expect(captureParticleScene(input, flow)).toMatchObject({ ok: false })
    flow.nodes[0].dragging = false
    flow.internals[0].internals.handleBounds = undefined
    expect(captureParticleScene(input, flow)).toMatchObject({ ok: false })
    flow.nodes.pop()
    expect(captureParticleScene(input, flow)).toMatchObject({ ok: false })
  })
})

class TestLayoutWorker {
  static instances: TestLayoutWorker[] = []
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() {
    TestLayoutWorker.instances.push(this)
  }
}
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  TestLayoutWorker.instances = []
})

describe("cancellable worker lifecycle", () => {
  it("terminates on cancellation and ignores a late result", async () => {
    vi.stubGlobal("Worker", TestLayoutWorker)
    const controller = new AbortController()
    const promise = runParticleWorker(
      { kind: "route", scene: sceneFixture() },
      controller.signal
    )
    const worker = TestLayoutWorker.instances[0]
    controller.abort()
    worker.onmessage?.({ data: { ok: true, value: [] } })
    expect(await promise).toMatchObject({
      ok: false,
      error: "Layout cancelled.",
    })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it("does not create a worker for an already cancelled job", async () => {
    vi.stubGlobal("Worker", TestLayoutWorker)
    const controller = new AbortController()
    controller.abort()
    expect(
      await runParticleWorker(
        { kind: "route", scene: sceneFixture() },
        controller.signal
      )
    ).toMatchObject({ ok: false })
    expect(TestLayoutWorker.instances).toHaveLength(0)
  })
  it("times out and releases its worker", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("Worker", TestLayoutWorker)
    const promise = runParticleWorker(
      { kind: "route", scene: sceneFixture() },
      new AbortController().signal
    )
    await vi.advanceTimersByTimeAsync(15000)
    expect(await promise).toMatchObject({
      ok: false,
      error: expect.stringContaining("timed out"),
    })
    expect(TestLayoutWorker.instances[0].terminate).toHaveBeenCalledOnce()
  })
  it("validates worker output before any save can be constructed", async () => {
    vi.stubGlobal("Worker", TestLayoutWorker)
    const promise = runParticleWorker(
      { kind: "layout", scene: sceneFixture(), scopeIds: [ID(2)] },
      new AbortController().signal
    )
    TestLayoutWorker.instances[0].onmessage?.({
      data: { ok: true, value: { nodes: [{ x: NaN }] } },
    })
    expect(await promise).toMatchObject({
      ok: false,
      error: expect.stringContaining("Invalid layout"),
    })
  })
  it("reports load failures and terminates successful workers", async () => {
    vi.stubGlobal("Worker", TestLayoutWorker)
    const request = { kind: "route" as const, scene: sceneFixture() }
    const failed = runParticleWorker(request, new AbortController().signal)
    TestLayoutWorker.instances[0].onerror?.()
    expect(await failed).toMatchObject({ ok: false })
    const success = runParticleWorker(request, new AbortController().signal)
    TestLayoutWorker.instances[1].onmessage?.({ data: { ok: true, value: [] } })
    expect(await success).toEqual({ ok: true, value: [] })
    expect(TestLayoutWorker.instances[1].terminate).toHaveBeenCalledOnce()
  })
})

it("keeps existing tool resource references out of movable ELK records", async () => {
  const input = graph(undefined, [
    edge(10, 1, 2, {
      target: "fiscal-sponsorship",
      targetHandle: "workspace-card-target-left",
      relationship: "related_resource",
    }),
  ])
  const result = await layoutParticleGraph({
    graph: input,
    measurements: measurements(input),
  })
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error)
  expect(result.value.nodes.map((item) => item.id).sort()).toEqual(
    input.particles.map((item) => item.id).sort()
  )
  expect(result.value.routes).toEqual([])
})
