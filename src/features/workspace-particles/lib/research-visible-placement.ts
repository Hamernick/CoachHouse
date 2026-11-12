import type { ResearchResult } from "@/features/workspace-ai/client"
import { overlaps, type Rect } from "@/lib/workspace-canvas/canvas-chat-geometry"
import type { ParticleGraph, ParticlePosition } from "../types"
import { particlePlacementBounds, PARTICLE_PLACEMENT_GAP } from "./particle-creation-placement"
import { researchPlanOperations } from "./research-plan"

/** Preview the canonical placement, without writing or moving existing particles. */
export function researchVisiblePlacement(graph: ParticleGraph, result: ResearchResult, actorId: string, chat: Rect, measured: Rect[] = []): ParticlePosition {
  const known = new Set(graph.particles.map(item => item.id))
  const obstacles = [...graph.particles.filter(item => !item.canvasHidden).map(item => particlePlacementBounds(item, true)), ...measured]
  const gap = PARTICLE_PLACEMENT_GAP
  const preview = (position: ParticlePosition) => researchPlanOperations(graph, result, actorId, new Date().toISOString(), () => crypto.randomUUID(), position)
    .flatMap(operation => operation.kind === "put_particle" && !known.has(operation.particle.id) ? [particlePlacementBounds(operation.particle, true)] : [])
  // Measure the complete generated branch away from occupied space, including
  // references/dependencies handled by the same canonical placement algorithm.
  const far = { x: Math.max(chat.x + chat.width, ...obstacles.map(box => box.x + box.width)) + gap, y: chat.y }
  const sample = preview(far)
  if (!sample.length) return far // Idempotent application: nothing new to place.
  const width = Math.max(...sample.map(box => box.x + box.width)) - Math.min(...sample.map(box => box.x))
  const height = Math.max(...sample.map(box => box.y + box.height)) - Math.min(...sample.map(box => box.y))
  const middle = chat.y + (chat.height - height) / 2
  const xs = [chat.x + chat.width + gap, chat.x - width - gap, far.x]
  const ys = [middle, ...obstacles.flatMap(box => [box.y - height - gap, box.y + box.height + gap])]
  const candidates = xs.flatMap(x => ys.map(y => ({ x, y }))).sort((a, b) =>
    Math.hypot(a.x + width / 2 - chat.x - chat.width / 2, a.y - middle) - Math.hypot(b.x + width / 2 - chat.x - chat.width / 2, b.y - middle))
  for (const position of candidates) {
    if (Math.abs(position.x) > 900_000 || Math.abs(position.y) > 900_000) continue
    const boxes = preview(position)
    if (boxes.every(box => !overlaps(box, chat, gap) && obstacles.every(obstacle => !overlaps(box, obstacle, gap)))) return position
  }
  throw new Error("No clear space beside the chat. Drag the plan onto an open area of the canvas.")
}
