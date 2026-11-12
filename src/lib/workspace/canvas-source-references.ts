import { z } from "zod"
import type { ParticleGraph } from "@/features/workspace-particles"

// Identifiers only: never send copied bodies, titles, URLs or transcript text.
export const canvasSourceReferencesSchema = z.strictObject({
  records: z.array(z.string().regex(/^particle:[0-9a-f-]{36}(?::(?:plan|proposal):[0-9a-f-]{36})?$/i)).max(2000),
  files: z.array(z.uuid()).max(2000),
  documents: z.array(z.string().min(1).max(120)).max(2000),
})
export type CanvasSourceReferences = z.infer<typeof canvasSourceReferencesSchema>
export const emptyCanvasSourceReferences = (): CanvasSourceReferences => ({ records: [], files: [], documents: [] })

export function particleSourceReferences(graph: ParticleGraph): CanvasSourceReferences {
  const records = new Set<string>(), files = new Set<string>(), documents = new Set<string>()
  for (const particle of graph.particles) {
    const id = `particle:${particle.id}`
    records.add(id)
    const widget = particle.type === "activity" ? particle.data.widget : undefined
    if ((widget?.kind === "document" || widget?.kind === "image") && widget.fileId) files.add(widget.fileId)
    if (widget?.kind === "document" && widget.source?.kind === "roadmap") documents.add(widget.source.sectionId)
    if (widget?.kind === "document" && widget.source?.kind === "workspace_note") records.add(`particle:${widget.source.id}`)
    const steps = particle.type === "activity" || particle.type === "workflow" ? particle.data.steps : particle.type === "decision" ? particle.data.criteria : []
    for (const step of steps) if (step.particleId) records.add(`particle:${step.particleId}`)
    if (particle.type === "calendar") for (const entry of particle.data.entries) if (entry.activityId) records.add(`particle:${entry.activityId}`)
    if (particle.type !== "objective") continue
    for (const workId of particle.data.outcomeConfirmation?.workIds ?? []) records.add(`particle:${workId}`)
    for (const [kind, plans] of [["plan", particle.data.planning?.plans ?? []], ["proposal", particle.data.planning?.proposals ?? []]] as const) {
      for (const plan of plans) {
        records.add(`${id}:${kind}:${plan.id}`)
        for (const member of plan.particleIds) records.add(`particle:${member}`)
        for (const source of plan.sources ?? []) {
          if (source.kind !== "workspace") continue
          if (source.id.startsWith("file:")) files.add(source.id.slice(5))
          const match = /^(?:document|roadmap):(.+)$/.exec(source.id)
          if (match) documents.add(match[1])
        }
      }
    }
  }
  return { records: [...records], files: [...files], documents: [...documents] }
}

/** Keep prior references for this mounted session: undo, detached drafts and
 * open viewers can still hold content after the current graph stops using it. */
export function mergeCanvasSourceReferences(previous: CanvasSourceReferences, next: CanvasSourceReferences) {
  const merged = { records: [...new Set([...previous.records, ...next.records])],
    files: [...new Set([...previous.files, ...next.files])], documents: [...new Set([...previous.documents, ...next.documents])] }
  return merged.records.length === previous.records.length && merged.files.length === previous.files.length && merged.documents.length === previous.documents.length ? previous : merged
}
