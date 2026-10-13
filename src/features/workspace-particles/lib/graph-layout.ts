import type { ElkNode } from "elkjs/lib/elk-api"
import { z } from "zod"
import type {
  ParticleBatch,
  ParticleGraph,
  ParticlePosition,
  ParticleResult,
} from "../types"
import { getParticleHandles } from "./particle-registry"
import { isParticleHierarchyEdge, readParticleGraph } from "./graph-validation"
import { particleIdSchema } from "./particle-schema"
import {
  routeParticleRelationship,
  segmentCrossesParticle,
} from "./orthogonal-routing"
import type { ParticleBounds } from "./selection"

const measurementSchema = z.strictObject({
  id: particleIdSchema,
  width: z.number().finite().min(1).max(4000),
  height: z.number().finite().min(1).max(10000),
  ports: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(64),
        side: z.enum(["WEST", "EAST"]),
        x: z.number().finite().min(0).max(4000),
        y: z.number().finite().min(0).max(10000),
      })
    )
    .min(2)
    .max(14),
})
export type ParticleMeasurement = z.infer<typeof measurementSchema>
export type ParticleLayout = {
  workspaceId: string
  revision: number
  measurementKey: string
  nodes: ParticleBounds[]
  routes: { id: string; points: ParticlePosition[] }[]
}
export type ParticleLayoutRunner = (
  graph: ElkNode,
  signal?: AbortSignal
) => Promise<ElkNode>
const portId = (id: string, handle: string) => `${id}/${handle}`

export function particleMeasurementKey(
  measurements: readonly ParticleMeasurement[]
) {
  return JSON.stringify(
    [...measurements]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        width: item.width,
        height: item.height,
        ports: [...item.ports]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map(({ id, side, x, y }) => ({ id, side, x, y })),
      }))
  )
}

async function runElk(graph: ElkNode, signal?: AbortSignal) {
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js")
  if (signal?.aborted) throw new Error("Layout cancelled.")
  const elk = new ELK()
  const terminate = () => {
    // ELK's bundled fallback uses a worker shim without terminate(). Real worker
    // runners can be injected; cancellation also fences late results below.
    try {
      elk.terminateWorker()
    } catch {
      /* No native worker to terminate. */
    }
  }
  signal?.addEventListener("abort", terminate, { once: true })
  try {
    return await elk.layout(graph)
  } finally {
    signal?.removeEventListener("abort", terminate)
    terminate()
  }
}

export async function layoutParticleGraph(
  input: {
    graph: ParticleGraph
    measurements: readonly ParticleMeasurement[]
    signal?: AbortSignal
    scopeIds?: readonly string[]
  },
  runner: ParticleLayoutRunner = runElk
): Promise<ParticleResult<ParticleLayout>> {
  const { graph, signal } = input
  const decoded = readParticleGraph(graph, graph.workspaceId)
  if (!decoded.ok) return decoded
  const scope = input.scopeIds ? new Set(input.scopeIds) : null
  const particles = graph.particles.filter(
    (item) => !scope || scope.has(item.id)
  )
  if (
    scope &&
    (scope.size !== input.scopeIds?.length || particles.length !== scope.size)
  )
    return { ok: false, code: "invalid", error: "Layout selection is invalid." }
  const connections = graph.connections.filter(
    (edge) =>
      particles.some((item) => item.id === edge.source) &&
      particles.some((item) => item.id === edge.target) &&
      (!scope || (scope.has(edge.source) && scope.has(edge.target)))
  )
  const parsed = z
    .array(measurementSchema)
    .max(250)
    .safeParse(input.measurements)
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid",
      error: "Particle measurements are invalid.",
    }
  const measurements = new Map(parsed.data.map((item) => [item.id, item]))
  if (
    measurements.size !== parsed.data.length ||
    measurements.size !== particles.length
  )
    return {
      ok: false,
      code: "invalid",
      error: "Measure every Particle exactly once before arranging.",
    }
  if (particles.some((item) => item.locked))
    return {
      ok: false,
      code: "locked",
      error:
        "Full-plan layout currently requires unlocked Particles. Saved positions were not changed.",
    }
  const children: ElkNode[] = []
  for (const particle of [...particles].sort((a, b) =>
    a.id === graph.rootId
      ? -1
      : b.id === graph.rootId
        ? 1
        : a.id.localeCompare(b.id)
  )) {
    const size = measurements.get(particle.id)
    if (!size)
      return {
        ok: false,
        code: "invalid",
        error: "A Particle has not been measured.",
      }
    const handles = getParticleHandles(particle)
    const expected = [...handles.inputs, ...handles.outputs]
    if (
      size.ports.length !== expected.length ||
      new Set(size.ports.map((port) => port.id)).size !== expected.length ||
      size.ports.some(
        (port) =>
          !expected.includes(port.id) ||
          port.y > size.height ||
          (port.id === "in"
            ? port.side !== "WEST" || port.x !== 0
            : port.side !== "EAST" || port.x !== size.width)
      )
    )
      return {
        ok: false,
        code: "invalid",
        error:
          "Measure the declared input/output handles on their card borders.",
      }
    children.push({
      id: particle.id,
      width: size.width,
      height: size.height,
      layoutOptions: {
        "elk.portConstraints": "FIXED_POS",
        ...(particle.id === graph.rootId
          ? { "elk.layered.layering.layerConstraint": "FIRST" }
          : {}),
      },
      ports: [...size.ports]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((port) => ({
          id: portId(particle.id, port.id),
          x: port.x,
          y: port.y,
          width: 0,
          height: 0,
          layoutOptions: { "elk.port.side": port.side },
        })),
    })
  }
  const elkInput: ElkNode = {
    id: "particle-plan",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.spacing.nodeNodeBetweenLayers": "112",
      "elk.spacing.nodeNode": "80",
      "elk.spacing.componentComponent": "112",
      "elk.padding": "[top=48,left=48,bottom=48,right=48]",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.randomSeed": "1",
    },
    children,
    edges: connections
      .filter(isParticleHierarchyEdge)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((edge) => ({
        id: edge.id,
        sources: [portId(edge.source, edge.sourceHandle)],
        targets: [portId(edge.target, edge.targetHandle)],
      })),
  }
  if (signal?.aborted)
    return { ok: false, code: "unavailable", error: "Layout cancelled." }
  let abort: (() => void) | undefined
  try {
    const cancelled = new Promise<never>((_, reject) => {
      abort = () => reject(new Error("Layout cancelled."))
      signal?.addEventListener("abort", abort, { once: true })
    })
    const output = await Promise.race([runner(elkInput, signal), cancelled])
    if (signal?.aborted)
      return { ok: false, code: "unavailable", error: "Layout cancelled." }
    const nodes: ParticleBounds[] = []
    for (const node of output.children ?? []) {
      const size = measurements.get(node.id)
      if (
        !size ||
        node.x === undefined ||
        node.y === undefined ||
        !Number.isFinite(node.x) ||
        !Number.isFinite(node.y)
      )
        throw new Error("Incomplete layout output.")
      nodes.push({
        id: node.id,
        x: node.x,
        y: node.y,
        width: size.width,
        height: size.height,
      })
    }
    if (
      nodes.length !== particles.length ||
      new Set(nodes.map((node) => node.id)).size !== nodes.length
    )
      throw new Error("Incomplete layout output.")
    for (let i = 0; i < nodes.length; i += 1)
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i],
          b = nodes[j]
        if (
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y
        )
          throw new Error("Layout contains overlapping Particles.")
      }
    const positions = new Map(nodes.map((node) => [node.id, node]))
    const routes: ParticleLayout["routes"] = []
    for (const edge of [...connections].sort((a, b) =>
      a.id.localeCompare(b.id)
    )) {
      const section = output.edges?.find(
        (item) => item.id === edge.id
      )?.sections
      let points: ParticlePosition[] | null
      if (isParticleHierarchyEdge(edge)) {
        if (section?.length !== 1)
          throw new Error("Missing orthogonal connection route.")
        points = [
          section[0].startPoint,
          ...(section[0].bendPoints ?? []),
          section[0].endPoint,
        ]
      } else {
        const source = positions.get(edge.source),
          target = positions.get(edge.target)
        const sourcePort = measurements
          .get(edge.source)
          ?.ports.find((port) => port.id === edge.sourceHandle)
        const targetPort = measurements
          .get(edge.target)
          ?.ports.find((port) => port.id === edge.targetHandle)
        if (!source || !target || !sourcePort || !targetPort)
          throw new Error("Missing connection port.")
        points = routeParticleRelationship(
          { x: source.x + sourcePort.x, y: source.y + sourcePort.y },
          { x: target.x + targetPort.x, y: target.y + targetPort.y },
          nodes
        )
      }
      if (
        !points ||
        points.some(
          (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y)
        )
      )
        throw new Error("Unable to route relationship.")
      for (let i = 1; i < points.length; i += 1) {
        if (
          nodes.some((node) =>
            segmentCrossesParticle(points[i - 1], points[i], node)
          )
        )
          throw new Error("Connection route crosses a Particle body.")
      }
      routes.push({ id: edge.id, points })
    }
    return {
      ok: true,
      value: {
        workspaceId: graph.workspaceId,
        revision: graph.revision,
        measurementKey: particleMeasurementKey(parsed.data),
        nodes,
        routes,
      },
    }
  } catch {
    return {
      ok: false,
      code: "unavailable",
      error: signal?.aborted
        ? "Layout cancelled."
        : "Unable to arrange this plan safely. Saved positions were not changed.",
    }
  } finally {
    if (abort) signal?.removeEventListener("abort", abort)
  }
}

export function particleLayoutBatch(
  graph: ParticleGraph,
  measurements: readonly ParticleMeasurement[],
  layout: ParticleLayout,
  id: string,
  scopeIds?: readonly string[]
): ParticleResult<ParticleBatch> {
  if (
    layout.workspaceId !== graph.workspaceId ||
    layout.revision !== graph.revision ||
    layout.measurementKey !== particleMeasurementKey(measurements)
  )
    return {
      ok: false,
      code: "conflict",
      error: "Layout is stale. Arrange the current plan again.",
    }
  const particles = new Map(
    graph.particles
      .filter((particle) => !scopeIds || scopeIds.includes(particle.id))
      .map((particle) => [particle.id, particle])
  )
  if (
    (scopeIds !== undefined &&
      (new Set(scopeIds).size !== scopeIds.length ||
        particles.size !== scopeIds.length)) ||
    !layout.nodes.length ||
    layout.nodes.length !== particles.size ||
    new Set(layout.nodes.map((node) => node.id)).size !== particles.size ||
    layout.nodes.some((node) => !particles.has(node.id))
  )
    return {
      ok: false,
      code: "invalid",
      error: "Layout does not cover this plan.",
    }
  return {
    ok: true,
    value: {
      id,
      workspaceId: graph.workspaceId,
      baseRevision: graph.revision,
      requireExactRevision: true,
      operations: [
        {
          kind: "move_particles",
          mode: "managed",
          positions: layout.nodes.map((node) => ({
            id: node.id,
            expectedRevision: particles.get(node.id)?.revision ?? 0,
            position: { x: node.x, y: node.y },
          })),
        },
      ],
    },
  }
}
