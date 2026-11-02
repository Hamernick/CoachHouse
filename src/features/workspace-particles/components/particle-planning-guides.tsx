"use client"

import { ViewportPortal } from "@xyflow/react"
import type { ParticleGraph } from "../types"
import { particlePlanMemberships, UNASSIGNED_ORIGIN } from "../lib/particle-creation-placement"

/** This is a canvas region, not a synthetic node or invented relationship. */
export function ParticlePlanningGuides({ graph }: { graph: ParticleGraph | null }) {
  if (!graph) return null
  const assigned = new Set(particlePlanMemberships(graph).flatMap(({ plan }) => plan.particleIds))
  const connected = new Set(graph.connections.flatMap(link => [link.source, link.target]))
  const unassigned = graph.particles.some(item => !item.canvasHidden && item.type !== "objective" && !assigned.has(item.id) && !connected.has(item.id) && item.position.x >= UNASSIGNED_ORIGIN.x && item.position.x < 0)
  if (!unassigned) return null
  return <ViewportPortal><div className="pointer-events-none absolute text-sm font-medium text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200" style={{ left: UNASSIGNED_ORIGIN.x, top: UNASSIGNED_ORIGIN.y - 44 }}>Unassigned</div></ViewportPortal>
}
