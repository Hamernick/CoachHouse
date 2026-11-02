import "server-only"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { canEditOrganization } from "@/lib/organization/active-org"
import { allWorkspaceStates } from "@/features/workspace-management"
import { readParticleGraph } from "@/features/workspace-particles"
import { researchTargetSchema, type ExistingResearchTarget, type ResearchTarget } from "../research-types"

type Actor = Awaited<ReturnType<typeof resolveAuthenticatedAppContext>>
type Graph = Extract<ReturnType<typeof readParticleGraph>, { ok: true }>['value']
type Objective = Extract<Graph['particles'][number], { type: "objective" }>
export type ResearchContext = Actor & { graph: Graph; objective?: Objective; canvasId: string | null; target: ResearchTarget }
export function loadResearchContext(target: ExistingResearchTarget, requireRevision?: boolean): Promise<ResearchContext & { objective: Objective }>
export function loadResearchContext(target: ResearchTarget, requireRevision?: boolean): Promise<ResearchContext>
export async function loadResearchContext(target: ResearchTarget, requireRevision = true): Promise<ResearchContext> {
  researchTargetSchema.parse(target)
  const actor = await resolveAuthenticatedAppContext()
  if (actor.activeOrg.orgId !== target.organizationId || !canEditOrganization(actor.activeOrg.role)) throw new Error("Open an editable workspace in your current organization.")
  const { data, error } = await actor.supabase.from("organization_workspace_boards").select("state").eq("org_id", target.organizationId).abortSignal(AbortSignal.timeout(10000)).maybeSingle()
  if (error) throw new Error("Workspace could not be loaded.")
  const canvases = allWorkspaceStates(data?.state)
  if (target.mode === "new_objective") {
    const matches = canvases.filter(canvas => canvas.id === target.canvasId)
    if (matches.length !== 1) throw new Error("Workspace unavailable. Reopen planning from the current workspace.")
    const graph = readParticleGraph(matches[0].state.particleGraph, target.organizationId)
    if (!graph.ok || (requireRevision && graph.value.revision !== target.revision))
      throw new Error("Workspace changed. Reopen planning from the current workspace.")
    return { ...actor, graph: graph.value, canvasId: matches[0].id, target }
  }
  const matches = canvases.flatMap(canvas => {
    const parsed = readParticleGraph(canvas.state.particleGraph, target.organizationId)
    if (!parsed.ok) return []
    const objective = parsed.value.particles.find(item => item.id === target.objectiveId && item.type === "objective")
    return objective?.type === "objective" ? [{ graph: parsed.value, objective, canvasId: canvas.id }] : []
  })
  if (matches.length !== 1 || (requireRevision && matches[0].objective.revision !== target.revision)) throw new Error("This objective changed. Reopen research from the current objective.")
  const selectedPlan = target.plan ? matches[0].objective.data.planning?.plans.find(plan => plan.id === target.plan!.id) : undefined
  if (requireRevision && target.plan && (!selectedPlan || selectedPlan.revision !== target.plan.revision))
    throw new Error("This plan changed. Reopen research from the current plan.")
  return { ...actor, ...matches[0], target }
}
