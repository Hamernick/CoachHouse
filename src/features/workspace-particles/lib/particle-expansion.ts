import type { Rect, Viewport } from "@xyflow/react"
import type { Particle } from "../types"

/** Source-specific editors retain their existing focused surface. */
export function supportsParticleExpansion(particle: Particle) {
  return particle.type !== "activity" || !particle.data.widget || particle.data.widget.kind === "form"
}

export const PARTICLE_EXPANDED_SIZE = { width: 560, height: 400 } as const
const overlaps = (a: Rect, b: Rect, gap = 16) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y
const valid = (r: Rect) => [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0

/** Keep the anchor and camera; use focused inspection when space is unavailable. */
export function particleExpansionFits(target: Rect, neighbors: readonly Rect[], viewport: Viewport, frame: Rect, overlays: readonly Rect[]) {
  if (!valid(target) || !valid(frame) || !Number.isFinite(viewport.zoom) || viewport.zoom <= 0 || !Number.isFinite(viewport.x) || !Number.isFinite(viewport.y)) return false
  if (neighbors.some(box => !valid(box) || overlaps(target, box))) return false
  const screen = { x: target.x * viewport.zoom + viewport.x, y: target.y * viewport.zoom + viewport.y, width: target.width * viewport.zoom, height: target.height * viewport.zoom }
  return screen.x >= 24 && screen.y >= 24 && screen.x + screen.width <= frame.width - 24 && screen.y + screen.height <= frame.height - 24 && !overlays.some(box => valid(box) && overlaps(screen, box, 24))
}

/** Conservative footprint while the single node-motion owner interpolates dimensions. */
export function reservedInspectionSize(data: Record<string, unknown> | undefined, width: number, height: number) {
  const reservation = data?.inspectionTransition
  if (reservation && typeof reservation === "object" && "width" in reservation && "height" in reservation && typeof reservation.width === "number" && typeof reservation.height === "number" && Number.isFinite(reservation.width) && Number.isFinite(reservation.height)) {
    return { width: Math.max(width, reservation.width), height: Math.max(height, reservation.height) }
  }
  return { width, height }
}
