import { normalizeObjectivePlans } from "@/features/workspace-objective-planner/client"
import type {
  ParticlePlacement,
  ParticleReference,
  ParticleSize,
  WorkspaceParticleState,
} from "../types"

export const PARTICLE_IMAGE_MAX_BYTES = 4 * 1024 * 1024
export const PARTICLE_LIMIT = 100
export const PARTICLE_SIZES = {
  icon: { width: 88, height: 88 },
  mini: { width: 288, height: 212 },
  large: { width: 640, height: 460 },
} as const
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_:.-]{0,159}$/
const IMAGE_PATH = /^[a-f0-9-]{36}\/particles\/[a-f0-9-]{36}\.(png|jpg|webp)$/

export function isParticleImagePath(value: unknown): value is string {
  return typeof value === "string" && IMAGE_PATH.test(value)
}

export function particleSourceKey(ref: ParticleReference) {
  return `${ref.kind}:${ref.id}`
}

export function particleDisplaySize(
  ref: ParticleReference,
  size: ParticleSize
): ParticleSize {
  return ref.kind === "roadmap" && ref.id !== "board_calendar" ? "icon" : size
}

export function normalizeParticleReference(
  value: unknown
): ParticleReference | null {
  if (!value || typeof value !== "object") return null
  const ref = value as Partial<ParticleReference>
  if (
    ref.kind !== "organization" &&
    ref.kind !== "activity" &&
    ref.kind !== "roadmap" &&
    ref.kind !== "drive" &&
    ref.kind !== "image" &&
    ref.kind !== "plan"
  )
    return null
  if (typeof ref.id !== "string" || !ID.test(ref.id)) return null
  return { kind: ref.kind, id: ref.id }
}

export function emptyWorkspaceParticleState(): WorkspaceParticleState {
  return {
    version: 1,
    items: [],
    images: [],
    connections: [],
    updatedAt: "1970-01-01T00:00:00.000Z",
  }
}

export function normalizeWorkspaceParticleState(
  value: unknown
): WorkspaceParticleState {
  const empty = emptyWorkspaceParticleState()
  if (!value || typeof value !== "object") return empty
  const input = value as Partial<WorkspaceParticleState>
  const plans = normalizeObjectivePlans(input.plans)
  const ids = new Set<string>()
  const sources = new Set<string>()
  const items: ParticlePlacement[] = []
  for (const item of Array.isArray(input.items)
    ? input.items.slice(0, PARTICLE_LIMIT)
    : []) {
    if (!item || typeof item !== "object") continue
    const source = normalizeParticleReference(item.source)
    if (
      !source ||
      source.kind === "organization" ||
      source.kind === "activity" ||
      typeof item.id !== "string" ||
      !item.id.startsWith("particle-") ||
      !ID.test(item.id)
    )
      continue
    if (
      typeof item.x !== "number" ||
      !Number.isFinite(item.x) ||
      typeof item.y !== "number" ||
      !Number.isFinite(item.y)
    )
      continue
    if (ids.has(item.id) || sources.has(particleSourceKey(source))) continue
    ids.add(item.id)
    sources.add(particleSourceKey(source))
    items.push({
      id: item.id,
      source,
      x: Math.round(Math.max(-50000, Math.min(50000, item.x))),
      y: Math.round(Math.max(-50000, Math.min(50000, item.y))),
      size: item.size === "icon" || item.size === "large" ? item.size : "mini",
    })
  }
  const imageIds = new Set<string>()
  const images = (Array.isArray(input.images) ? input.images : [])
    .slice(0, PARTICLE_LIMIT)
    .flatMap((image) => {
      if (
        !image ||
        typeof image.id !== "string" ||
        !ID.test(image.id) ||
        imageIds.has(image.id) ||
        !isParticleImagePath(image.path)
      )
        return []
      imageIds.add(image.id)
      return [
        {
          id: image.id,
          title:
            typeof image.title === "string"
              ? image.title.trim().slice(0, 160) || "Image"
              : "Image",
          path: image.path,
        },
      ]
    })
  const pairs = new Set<string>()
  const connections = (
    Array.isArray(input.connections) ? input.connections : []
  )
    .slice(0, 300)
    .flatMap((edge) => {
      if (
        !edge ||
        typeof edge.source !== "string" ||
        typeof edge.target !== "string"
      )
        return []
      if (
        !ID.test(edge.source) ||
        !ID.test(edge.target) ||
        edge.source === edge.target
      )
        return []
      if (!ids.has(edge.source) && !ids.has(edge.target)) return []
      if (
        (edge.source.startsWith("particle-") && !ids.has(edge.source)) ||
        (edge.target.startsWith("particle-") && !ids.has(edge.target))
      )
        return []
      const pair = `${edge.source}->${edge.target}`
      if (pairs.has(pair)) return []
      pairs.add(pair)
      return [
        {
          id: `particle-edge:${pair}`,
          source: edge.source,
          target: edge.target,
        },
      ]
    })
  return {
    version: 1,
    ...(plans.length ? { plans } : {}),
    items,
    images,
    connections,
    updatedAt:
      typeof input.updatedAt === "string" &&
      Number.isFinite(Date.parse(input.updatedAt))
        ? new Date(input.updatedAt).toISOString()
        : empty.updatedAt,
  }
}

export function removeParticle(
  state: WorkspaceParticleState,
  id: string
): WorkspaceParticleState {
  return {
    ...state,
    items: state.items.filter((item) => item.id !== id),
    connections: state.connections.filter(
      (edge) => edge.source !== id && edge.target !== id
    ),
  }
}

export function resizeParticle(
  item: ParticlePlacement,
  size: ParticleSize
): ParticlePlacement {
  const previous = PARTICLE_SIZES[item.size]
  const next = PARTICLE_SIZES[size]
  return {
    ...item,
    size,
    x: item.x + (previous.width - next.width) / 2,
    y: item.y + (previous.height - next.height) / 2,
  }
}

export function preferNewerParticleState(
  incoming: WorkspaceParticleState | undefined,
  persisted: WorkspaceParticleState | undefined
) {
  if (!persisted) return incoming
  if (
    !incoming ||
    Date.parse(persisted.updatedAt) > Date.parse(incoming.updatedAt)
  )
    return persisted
  return incoming
}
