import "server-only"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { canEditOrganization } from "@/lib/organization/active-org"
import { allWorkspaceStates } from "@/features/workspace-management"
import { readParticleGraph } from "@/features/workspace-particles"
import { researchTargetSchema, type ResearchTarget } from "../research-types"

export async function loadResearchContext(target: ResearchTarget, requireRevision = true) {
  researchTargetSchema.parse(target)
  const actor = await resolveAuthenticatedAppContext()
  if (actor.activeOrg.orgId !== target.organizationId || !canEditOrganization(actor.activeOrg.role)) throw new Error("Open an editable workspace in your current organization.")
  const { data, error } = await actor.supabase.from("organization_workspace_boards").select("state").eq("org_id", target.organizationId).abortSignal(AbortSignal.timeout(10000)).maybeSingle()
  if (error) throw new Error("Workspace could not be loaded.")
  const matches = allWorkspaceStates(data?.state).flatMap(canvas => {
    const parsed = readParticleGraph(canvas.state.particleGraph, target.organizationId)
    if (!parsed.ok) return []
    const objective = parsed.value.particles.find(item => item.id === target.objectiveId && item.type === "objective")
    return objective?.type === "objective" ? [{ graph: parsed.value, objective, canvasId: canvas.id }] : []
  })
  if (matches.length !== 1 || (requireRevision && matches[0].objective.revision !== target.revision)) throw new Error("This objective changed. Reopen research from the current objective.")
  return { ...actor, ...matches[0], target }
}
export type ResearchContext = Awaited<ReturnType<typeof loadResearchContext>>
