import "server-only"
import { inaccessibleParticleDocuments } from "@/lib/organization/particle-document-audience"
import { retainedParticleFiles } from "@/lib/organization/particle-ai-origins"
import { particleNativeFileDependencies, nativeFilesForRecords, inaccessibleNativeFiles } from "@/lib/organization/particle-file-dependencies"
import type { ResearchContext } from "./research-context"

/** The implicit context sent by researchContextProjection, including uncited
 * objective/plan titles. Broader graph contents are not implicitly disclosed.
 */
export function initialResearchParticleIds(context: ResearchContext): string[] {
  if (context.target.mode === "new_objective") return context.graph.particles
    .filter(particle => particle.type === "objective" && !context.inaccessibleParticleIds?.has(`particle:${particle.id}`))
    .slice(0, 8).map(particle => `particle:${particle.id}`)
  if (!context.objective) return []
  const root = `particle:${context.objective.id}`
  const planning = context.objective.data.planning
  const selected = planning?.plans.find(plan => plan.id === context.target.plan?.id)
  return [...new Set([
    root,
    ...(selected ? [`${root}:plan:${selected.id}`, ...selected.particleIds.map(id => `particle:${id}`)]
      : (planning?.plans ?? []).slice(0, 4).map(plan => `${root}:plan:${plan.id}`)),
    ...(planning?.proposals ?? []).filter(proposal => proposal.status === "pending").slice(0, 4)
      .map(proposal => `${root}:proposal:${proposal.id}`),
  ])]
}

export async function authorizeResearchFileContext<T extends ResearchContext>(context: T): Promise<T> {
  const current = particleNativeFileDependencies(context.graph)
  const retained = await retainedParticleFiles(context.target.organizationId, context.user.id, current.keys())
  const dependencies = particleNativeFileDependencies(context.graph, retained)
  const denied = await inaccessibleNativeFiles(nativeFilesForRecords(dependencies, dependencies.keys()), context.user.id, { organizationId: context.target.organizationId, canvasId: context.canvasId })
  const inaccessibleParticleIds = new Set([...dependencies].filter(([, files]) => [...files].some(id => denied.has(id))).map(([id]) => id))
  for (const id of await inaccessibleParticleDocuments(context.graph, context.user.id, { organizationId: context.target.organizationId, canvasId: context.canvasId })) inaccessibleParticleIds.add(id)
  // Keep the canonical graph intact for revision-checked mutations. Only the AI
  // overview is projected; inaccessible selected objectives cannot be revised.
  const authorized = { ...context, inaccessibleParticleIds, retainedParticleFiles: retained }
  if ((context.objective && inaccessibleParticleIds.has(`particle:${context.objective.id}`)) ||
      nativeFilesForRecords(dependencies, initialResearchParticleIds(authorized)).length > 256)
    throw new Error("Research context is unavailable. Choose an accessible objective.")
  return authorized
}
