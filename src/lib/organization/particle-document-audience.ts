import "server-only"
import type { WorkspaceAiSourceScope } from "./workspace-ai-source-context"
import type { ParticleGraph } from "@/features/workspace-particles"
import { inaccessibleEditorDocuments } from "./document-source-access"
import { retainedParticleDocuments } from "./particle-ai-origins"

/** Current references/citations and explicitly retained document inputs. Missing
 * historical inputs are not inferred from titles or treated as complete lineage.
 * Parent organization authorization must precede this service-side projection. */
export async function inaccessibleParticleDocuments(graph: ParticleGraph, actorId: string, scope?: WorkspaceAiSourceScope) {
  const documents = new Map<string, Set<string>>()
  const references = new Map<string, Set<string>>()
  const add = (map: Map<string, Set<string>>, id: string, values: string[]) => {
    const entries = map.get(id) ?? new Set<string>()
    for (const value of values) entries.add(value)
    map.set(id, entries)
  }
  const key = (id: string) => `particle:${id}`
  for (const particle of graph.particles) {
    const id = key(particle.id)
    const widget = particle.type === "activity" ? particle.data.widget : undefined
    if (widget?.kind === "document" && widget.source?.kind === "roadmap")
      add(documents, id, [widget.source.sectionId])
    if (widget?.kind === "document" && widget.source?.kind === "workspace_note")
      add(references, id, [key(widget.source.id)])
    const steps = particle.type === "activity" || particle.type === "workflow" ? particle.data.steps
      : particle.type === "decision" ? particle.data.criteria : []
    add(references, id, steps.flatMap(step => step.particleId ? [key(step.particleId)] : []))
    if (particle.type === "calendar")
      add(references, id, particle.data.entries.flatMap(entry => entry.activityId ? [key(entry.activityId)] : []))
    if (particle.type !== "objective") continue
    add(references, id, (particle.data.outcomeConfirmation?.workIds ?? []).map(key))
    for (const [kind, plans] of [["plan", particle.data.planning?.plans ?? []], ["proposal", particle.data.planning?.proposals ?? []]] as const) {
      for (const plan of plans) {
        const planId = `${id}:${kind}:${plan.id}`
        const citations = (plan.sources ?? []).flatMap(source => {
          if (source.kind !== "workspace") return []
          const match = /^(?:document|roadmap):(.+)$/.exec(source.id)
          return match ? [match[1]] : []
        })
        add(documents, planId, citations)
        if (plan.researchRunId) for (const member of plan.particleIds) add(documents, key(member), citations)
        add(references, planId, [id, ...plan.particleIds.map(key)])
        add(references, id, [planId])
      }
    }
  }
  const retained = await retainedParticleDocuments(graph.workspaceId, actorId, references.keys())
  for (const [id, sources] of retained) add(documents, id, [...sources])
  const requested = new Set([...documents.values()].flatMap(ids => [...ids]))
  if (!requested.size) return new Set<string>()
  const denied = await inaccessibleEditorDocuments(requested, graph.workspaceId, actorId, scope)
  const hidden = new Set([...documents].filter(([, ids]) => [...ids].some(id => denied.has(id))).map(([id]) => id))
  let changed = true
  while (changed) {
    changed = false
    for (const [id, sources] of references) if (!hidden.has(id) && [...sources].some(source => hidden.has(source))) {
      hidden.add(id)
      changed = true
    }
  }
  return hidden
}
