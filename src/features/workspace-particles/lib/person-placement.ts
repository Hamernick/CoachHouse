import { z } from "zod"
import type { Particle, ParticleGraph, ParticleOperation, ParticleResult } from "../types"
import { particleIdSchema, particlePositionSchema, particleSchema } from "./particle-schema"
import { createParticle } from "./particle-registry"
import { placeParticle } from "./particle-placement"

const placementSchema = z.strictObject({
  personId: particleIdSchema,
  position: particlePositionSchema,
})
const placementsSchema = z.array(placementSchema).max(250).refine(
  (items) => new Set(items.map((item) => item.personId)).size === items.length,
  "Person placements must be unique."
)
export type PersonPlacement = z.infer<typeof placementSchema>
type PeopleParticle = Extract<Particle, { type: "people" }>
type PersonPlacementParticle = PeopleParticle & {
  data: PeopleParticle["data"] & { presentation: "person" }
}

export function isPersonPlacement(particle: Particle): particle is PersonPlacementParticle {
  return particle.type === "people" && particle.data.presentation === "person"
}

/** One placement per person, including hidden placements. Contact details remain
 * profile-owned and are resolved at render time, never copied into this record. */
export function personPlacements(graph: ParticleGraph) {
  return new Map(graph.particles.filter(isPersonPlacement).map((particle) => [
    particle.data.personIds[0], particle,
  ]))
}

/** Shared command for Add/drop. A visible placement is a no-op; re-adding a
 * hidden placement retains its ID, connections and lock policy. Server source
 * authorization and graph revision checks still run when these operations commit. */
export function planPersonPlacements({
  graph,
  placements,
  uuid,
  now,
}: {
  graph: ParticleGraph
  placements: readonly PersonPlacement[]
  uuid: () => string
  now: string
}): ParticleResult<ParticleOperation[]> {
  const parsed = placementsSchema.safeParse(placements)
  if (!parsed.success)
    return { ok: false, code: "invalid", error: "Invalid person placement." }
  const existing = personPlacements(graph)
  const newCount = parsed.data.filter((item) => !existing.has(item.personId)).length
  if (graph.particles.length + newCount > 250)
    return { ok: false, code: "invalid", error: "The board has reached its Particle limit." }
  const operations: ParticleOperation[] = []
  const usedIds = new Set(graph.particles.map((particle) => particle.id))
  for (const placement of parsed.data) {
    const before = existing.get(placement.personId)
    if (before && !before.canvasHidden) continue
    if (before) {
      operations.push({
        kind: "put_particle",
        particle: placeParticle(before, true, placement.position),
        expectedRevision: before.revision,
      })
      continue
    }
    const id = uuid()
    if (!particleIdSchema.safeParse(id).success || usedIds.has(id))
      return { ok: false, code: "invalid", error: "Invalid person placement ID." }
    usedIds.add(id)
    const created = particleSchema.safeParse({
      ...createParticle("people", { id, workspaceId: graph.workspaceId, now, title: "Person" }),
      position: placement.position,
      positionMode: "manual",
      data: { presentation: "person", personIds: [placement.personId], segment: "" },
    })
    if (!created.success)
      return { ok: false, code: "invalid", error: "Invalid person placement." }
    operations.push({ kind: "put_particle", particle: created.data, expectedRevision: null })
  }
  return { ok: true, value: operations }
}

/** Recovery is an explicit one-time integration step, not an on-render sync.
 * Shared records win even when hidden: stale local positions cannot move them
 * or resurrect removed cards. This pure planner never erases browser storage;
 * the caller may acknowledge recovery only after the batch is confirmed. */
export function planLocalPersonPlacementRecovery({
  graph, placements, availablePersonIds, uuid, now,
}: {
  graph: ParticleGraph
  placements: readonly PersonPlacement[]
  availablePersonIds: ReadonlySet<string>
  uuid: () => string
  now: string
}): ParticleResult<ParticleOperation[]> {
  const existing = personPlacements(graph)
  const seen = new Set<string>()
  const candidates = placements.filter((placement) => {
    if (!availablePersonIds.has(placement.personId) || existing.has(placement.personId) || seen.has(placement.personId))
      return false
    seen.add(placement.personId)
    return true
  })
  return planPersonPlacements({ graph, placements: candidates, uuid, now })
}
