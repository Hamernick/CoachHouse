import { semanticParticleHandle } from "./particle-handle-ids"
import { isWorkspaceToolId } from "./workspace-tool-contract"
import { particleConnectionSchema } from "./particle-schema"
import { readParticleGraph, isParticleHierarchyEdge } from "./graph-validation"
import { createParticle, particleRegistry } from "./particle-registry"
import type {
  ParticleConnection,
  ParticleGraph,
  ParticleOperation,
  ParticlePosition,
  ParticleResult,
  ParticleType,
} from "../types"

export type ParticleLinkInput = {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  relationship?: ParticleConnection["relationship"]
}
export const PARTICLE_RELATIONSHIP_LABELS = {
  dependency: "Dependency",
  sequence: "Sequence",
  decision_outcome: "Decision outcome",
  related_resource: "Related resource",
  feedback: "Feedback loop",
} as const

export function buildParticleLink(
  graph: ParticleGraph,
  input: ParticleLinkInput,
  id: string,
  visibleTools: readonly string[] = []
): ParticleResult<ParticleConnection> {
  const source = graph.particles.find((item) => item.id === input.source)
  const target = graph.particles.find((item) => item.id === input.target)
  const sourceTool = isWorkspaceToolId(input.source)
  const targetTool = isWorkspaceToolId(input.target)
  const available = (id: string) =>
    isWorkspaceToolId(id) && visibleTools.includes(id)
  if (
    (!source && !available(input.source)) ||
    (!target && !available(input.target)) ||
    source?.canvasHidden ||
    target?.canvasHidden
  )
    return {
      ok: false,
      code: "invalid",
      error: "Choose two Particles currently on the canvas.",
    }
  const rawSourceHandle =
    input.sourceHandle ?? (sourceTool ? "workspace-card-source-right" : "out")
  const handle = sourceTool
    ? rawSourceHandle
    : semanticParticleHandle(rawSourceHandle)
  const rawTargetHandle =
    input.targetHandle ?? (targetTool ? "workspace-card-target-left" : "in")
  const outcome = handle.startsWith("outcome:") ? handle.slice(8) : undefined
  const parsed = particleConnectionSchema.safeParse({
    id,
    source: input.source,
    target: input.target,
    sourceHandle: handle,
    targetHandle: targetTool
      ? rawTargetHandle
      : semanticParticleHandle(rawTargetHandle),
    outcome,
    relationship:
      input.relationship ??
      (sourceTool || targetTool
        ? "related_resource"
        : outcome
          ? "decision_outcome"
          : "dependency"),
    revision: 0,
  })
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid",
      error: "Choose a valid connection and its handles.",
    }
  const checked = readParticleGraph(
    { ...graph, connections: [...graph.connections, parsed.data] },
    graph.workspaceId
  )
  return checked.ok ? { ok: true, value: parsed.data } : checked
}

export function buildParticleInsertion(
  graph: ParticleGraph,
  edgeId: string,
  options: {
    id: string
    linkId: string
    type: ParticleType
    now: string
    position: ParticlePosition
  }
): ParticleResult<ParticleOperation[]> {
  const connection = graph.connections.find((item) => item.id === edgeId)
  if (!connection || !isParticleHierarchyEdge(connection))
    return {
      ok: false,
      code: "invalid",
      error:
        "Insert steps into dependency, sequence or decision-outcome connections.",
    }
  if (
    [connection.source, connection.target].some(
      (id) => graph.particles.find((item) => item.id === id)?.canvasHidden
    )
  )
    return {
      ok: false,
      code: "invalid",
      error:
        "Place both connected Particles on the canvas before inserting a step.",
    }
  if (
    graph.particles.some((item) => item.id === options.id) ||
    graph.connections.some((item) => item.id === options.linkId)
  )
    return {
      ok: false,
      code: "invalid",
      error: "New Particle and connection IDs must be unique.",
    }
  const particle = {
    ...createParticle(options.type, {
      id: options.id,
      workspaceId: graph.workspaceId,
      title: particleRegistry[options.type].label,
      now: options.now,
    }),
    position: options.position,
    positionMode: "manual" as const,
  }
  // Keep the original incoming link's identity and outcome. Only its target changes.
  const incoming = { ...connection, target: particle.id }
  const outgoing: ParticleConnection = {
    id: options.linkId,
    source: particle.id,
    target: connection.target,
    sourceHandle: "out",
    targetHandle: "in",
    relationship:
      connection.relationship === "dependency" ? "dependency" : "sequence",
    revision: 0,
  }
  const checked = readParticleGraph(
    {
      ...graph,
      particles: [...graph.particles, particle],
      connections: [
        ...graph.connections.filter((item) => item.id !== edgeId),
        incoming,
        outgoing,
      ],
    },
    graph.workspaceId
  )
  if (!checked.ok) return checked
  return {
    ok: true,
    value: [
      { kind: "put_particle", particle, expectedRevision: null },
      {
        kind: "put_connection",
        connection: incoming,
        expectedRevision: connection.revision,
      },
      { kind: "put_connection", connection: outgoing, expectedRevision: null },
    ],
  }
}
