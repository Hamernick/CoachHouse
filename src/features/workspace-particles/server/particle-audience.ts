import "server-only"
import { inaccessibleParticleDocuments } from "@/lib/organization/particle-document-audience"
import { retainedParticleFiles } from "@/lib/organization/particle-ai-origins"
import { inaccessibleNativeFiles, nativeFilesForRecords, particleNativeFileDependencies } from "@/lib/organization/particle-file-dependencies"
import type { Particle, ParticleGraph } from "../types"
import { ParticleMutationError } from "../lib/authorized-mutation"
import { readParticleGraph } from "../lib/graph-validation"

/** References may carry copied titles/bodies. Withhold the containing record,
 * rather than editing canonical content or returning a broken partial plan. */
function referencedParticles(particle: Particle): string[] {
  const steps = particle.type === "activity" || particle.type === "workflow" ? particle.data.steps
    : particle.type === "decision" ? particle.data.criteria : []
  const ids = steps.flatMap(step => step.particleId ? [step.particleId] : [])
  if (particle.type === "calendar") ids.push(...particle.data.entries.flatMap(entry => entry.activityId ? [entry.activityId] : []))
  if (particle.type === "objective") {
    ids.push(...(particle.data.outcomeConfirmation?.workIds ?? []))
    for (const plan of [...(particle.data.planning?.plans ?? []), ...(particle.data.planning?.proposals ?? [])]) ids.push(...plan.particleIds)
  }
  if (particle.type === "activity") {
    const widget = particle.data.widget
    if (widget?.kind === "document" && widget.source?.kind === "workspace_note") ids.push(widget.source.id)
  }
  return ids
}

/** Parent org authorization is required first. Check native files, retained AI
 * inputs and current editor-document references/citations. This is not complete
 * historical provenance, all source authority, or a direct-table cutover. */
export async function projectParticleGraphAudience(graph: ParticleGraph, actorId: string): Promise<ParticleGraph> {
  const current = particleNativeFileDependencies(graph)
  const retained = await retainedParticleFiles(graph.workspaceId, actorId, current.keys())
  const dependencies = particleNativeFileDependencies(graph, retained)
  const deniedFiles = await inaccessibleNativeFiles(nativeFilesForRecords(dependencies, dependencies.keys()), actorId)
  const deniedDocuments = await inaccessibleParticleDocuments(graph, actorId)
  const hidden = new Set(graph.particles.filter(particle =>
    deniedDocuments.has(`particle:${particle.id}`) || [...(dependencies.get(`particle:${particle.id}`) ?? [])].some(id => deniedFiles.has(id))
  ).map(particle => particle.id))
  let changed = true
  while (changed) {
    changed = false
    for (const particle of graph.particles) if (!hidden.has(particle.id) && referencedParticles(particle).some(id => hidden.has(id))) {
      hidden.add(particle.id)
      changed = true
    }
  }
  if (!hidden.size) return graph
  return {
    ...graph,
    rootId: graph.rootId && hidden.has(graph.rootId) ? null : graph.rootId,
    particles: graph.particles.filter(particle => !hidden.has(particle.id)),
    connections: graph.connections.filter(edge => !hidden.has(edge.source) && !hidden.has(edge.target)),
    // Receipts are internal replay authority; a partial client does not need
    // fingerprints of operations it cannot read. Keep the canonical revision.
    receipts: [],
  }
}

/** Run against each latest CAS snapshot, never against the client's projection.
 * Check both sides so removing/changing a reference cannot bypass revocation.
 * The same check before returning a commit protects inverse operations too. */
export async function assertParticleAudienceMutation(previous: ParticleGraph, next: ParticleGraph, actorId: string) {
  const before = await projectParticleGraphAudience(previous, actorId)
  const after = await projectParticleGraphAudience(next, actorId)
  const visibleBefore = new Set(before.particles.map(particle => particle.id))
  const visibleAfter = new Set(after.particles.map(particle => particle.id))
  const prior = new Map(previous.particles.map(particle => [particle.id, particle]))
  const following = new Map(next.particles.map(particle => [particle.id, particle]))
  const hidden = new Set([...previous.particles.filter(particle => !visibleBefore.has(particle.id)),
    ...next.particles.filter(particle => !visibleAfter.has(particle.id))].map(particle => particle.id))
  const denied = () => { throw new ParticleMutationError("scope", "This content is unavailable. Refresh and try again.") }
  for (const id of hidden) if (JSON.stringify(prior.get(id)) !== JSON.stringify(following.get(id))) denied()
  const edges = new Map(previous.connections.map(edge => [edge.id, edge]))
  const nextEdges = new Map(next.connections.map(edge => [edge.id, edge]))
  for (const edge of [...previous.connections, ...next.connections])
    if ((hidden.has(edge.source) || hidden.has(edge.target)) && JSON.stringify(edges.get(edge.id)) !== JSON.stringify(nextEdges.get(edge.id))) denied()
  if (previous.rootId !== next.rootId && ((previous.rootId && hidden.has(previous.rootId)) || (next.rootId && hidden.has(next.rootId)))) denied()
  return after
}

export async function projectStoredParticleGraphAudience(value: unknown, organizationId: string, actorId: string) {
  const parsed = readParticleGraph(value, organizationId)
  if (!parsed.ok) throw new ParticleMutationError(parsed.code, parsed.error)
  return projectParticleGraphAudience(parsed.value, actorId)
}
