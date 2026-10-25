import {
  createParticle,
  emptyParticleGraph,
  getParticleHandles,
  type Particle,
  type ParticleBatch,
  type ParticleConnection,
  type ParticleGraph,
  type ParticleMeasurement,
  type ParticleOperation,
  type ParticleType,
} from "@/features/workspace-particles"

export const NOW = "2026-10-10T02:00:00.000Z"
export const ID = (value: number) =>
  `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`
export const WORKSPACE = ID(999)
export function particle(
  id: number,
  type: ParticleType = "activity"
): Particle {
  return createParticle(type, { id: ID(id), workspaceId: WORKSPACE, now: NOW })
}
export function graph(
  items: Particle[] = [particle(1, "objective"), particle(2)],
  edges: ParticleConnection[] = []
): ParticleGraph {
  return {
    ...emptyParticleGraph(WORKSPACE),
    particles: items,
    connections: edges,
  }
}
export function edge(
  id: number,
  source: number,
  target: number,
  extra: Partial<ParticleConnection> = {}
): ParticleConnection {
  return {
    id: ID(id),
    source: ID(source),
    target: ID(target),
    sourceHandle: "out",
    targetHandle: "in",
    revision: 0,
    relationship: "dependency",
    ...extra,
  }
}
export function batch(
  id: number,
  operations: ParticleOperation[],
  baseRevision = 0
): ParticleBatch {
  return {
    id: ID(id),
    workspaceId: WORKSPACE,
    baseRevision,
    requireExactRevision: false,
    operations,
  }
}
export function measurements(input: ParticleGraph): ParticleMeasurement[] {
  return input.particles.map((item, index) => {
    const width = item.type === "calendar" ? 340 : 280
    const height = 180 + (index % 4) * 67
    const handles = getParticleHandles(item)
    return {
      id: item.id,
      width,
      height,
      ports: [
        { id: "in", side: "WEST", x: 0, y: height / 2 },
        ...handles.outputs.map((id, portIndex) => ({
          id,
          side: "EAST" as const,
          x: width,
          y: (height * (portIndex + 1)) / (handles.outputs.length + 1),
        })),
      ],
    }
  })
}
