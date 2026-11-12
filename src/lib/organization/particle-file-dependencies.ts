import "server-only"
import type { WorkspaceAiSourceScope } from "./workspace-ai-source-context"
import { z } from "zod"
import type { ParticleGraph } from "@/features/workspace-particles"
import { filterDocumentFileAudience } from "./document-file-audience"

/** Known native-file lineage only. Citations cannot prove that older generated
 * prose has no uncited inputs; private-board activation still requires durable
 * origin provenance and an authorized board read/write projection.
 */
export function particleNativeFileDependencies(graph: ParticleGraph, retained = new Map<string, Set<string>>()) {
  const dependencies = new Map([...retained].map(([id, files]) => [id, new Set(files)]))
  const entry = (id: string) => {
    let files = dependencies.get(id)
    if (!files) dependencies.set(id, files = new Set())
    return files
  }
  const aggregates: { id: string; members: string[] }[] = []
  for (const particle of graph.particles) {
    const id = `particle:${particle.id}`, files = entry(id)
    const widget = particle.type === "activity" ? particle.data.widget : undefined
    if ((widget?.kind === "document" || widget?.kind === "image") && widget.fileId) files.add(widget.fileId)
    if (particle.type !== "objective") continue
    const planning = particle.data.planning
    for (const [kind, plans] of [["plan", planning?.plans ?? []], ["proposal", planning?.proposals ?? []]] as const) {
      for (const plan of plans) {
        const planId = `${id}:${kind}:${plan.id}`, planFiles = entry(planId)
        for (const source of plan.sources ?? []) {
          if (source.kind !== "workspace" || !source.id.startsWith("file:")) continue
          const fileId = source.id.slice(5)
          if (!z.uuid().safeParse(fileId).success) throw new Error("Plan source access could not be verified.")
          planFiles.add(fileId)
        }
        // Generated members may copy evidence into their titles and bodies.
        // Ordinary grouping does not taint independently authored members.
        if (plan.researchRunId) for (const member of plan.particleIds)
          for (const file of planFiles) entry(`particle:${member}`).add(file)
        // A plan knowledge record includes its parent objective's title too.
        aggregates.push({ id: planId, members: [id, ...plan.particleIds.map(member => `particle:${member}`)] })
        aggregates.push({ id, members: [planId] })
      }
    }
  }
  // Plan references can themselves contain objectives in older stored graphs.
  // Monotone sets terminate even for cycles; no recursive disclosure or writes.
  let changed = true
  while (changed) {
    changed = false
    for (const aggregate of aggregates) for (const member of aggregate.members)
      for (const file of entry(member)) if (!entry(aggregate.id).has(file)) {
        entry(aggregate.id).add(file)
        changed = true
      }
  }
  return dependencies
}

export function nativeFilesForRecords(dependencies: Map<string, Set<string>>, ids: Iterable<string>) {
  const files = new Set<string>()
  for (const id of ids) for (const file of dependencies.get(id) ?? []) files.add(file)
  return [...files].sort()
}

export async function inaccessibleNativeFiles(fileIds: Iterable<string>, actorId: string, scope?: WorkspaceAiSourceScope) {
  const ids = [...new Set(fileIds)]
  const allowed = new Set((await filterDocumentFileAudience(ids.map(id => ({ id })), actorId, scope)).map(row => row.id))
  return new Set(ids.filter(id => !allowed.has(id)))
}

