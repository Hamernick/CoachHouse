import "server-only"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { canEditOrganization, resolveActiveOrganization } from "@/lib/organization/active-org"
import { createWorkspaceObjectiveAction, loadWorkspaceObjectivesAction } from "./actions"
import type { ObjectiveEdit, ObjectiveIslandData, ObjectiveMutationResult, ObjectiveScope } from "../island-types"

const scopeSchema = z.object({ userId: z.uuid(), organizationId: z.uuid() })
const titleSchema = z.string().trim().min(1, "Enter an objective.").max(240)
const editSchema = z.object({
  id: z.uuid(), expectedUpdatedAt: z.string().min(1), title: titleSchema,
  description: z.string().max(10000), status: z.enum(["todo", "in_progress", "blocked", "done", "archived"]),
})
async function actor(scope: ObjectiveScope, write = false) {
  scopeSchema.parse(scope)
  const client = await createSupabaseServerClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || user.id !== scope.userId) throw new Error("Sign in again to use Objectives.")
  const active = await resolveActiveOrganization(client, user.id)
  if (active.orgId !== scope.organizationId) throw new Error("Reopen Objectives in your current organization.")
  if (write && !canEditOrganization(active.role)) throw new Error("You do not have permission to edit objectives.")
  return { client, userId: user.id, orgId: active.orgId }
}
function failure(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof z.ZodError ? "Check the objective details." : error instanceof Error ? error.message : "Unable to update objectives." }
}
export async function loadObjectiveIsland(scope: ObjectiveScope): Promise<{ ok: true; data: ObjectiveIslandData } | { ok: false; error: string }> {
  try {
    const { client, orgId } = await actor(scope)
    const collection = await loadWorkspaceObjectivesAction()
    if (!collection.ok) return collection
    if (collection.data.loadedFrom !== "normalized") return { ok: true, data: { ...collection.data, steps: [] } }
    const { data, error } = await client.from("organization_workspace_objective_steps")
      .select("id, objective_id, title, status, step_type, step_order, updated_at").eq("org_id", orgId).order("step_order")
    if (error) throw new Error("Unable to load objective steps.")
    return { ok: true, data: { ...collection.data, steps: (data ?? []).map(row => ({
      editable: row.step_type === "custom", id: row.id, objectiveId: row.objective_id, title: row.title,
      status: row.status as ObjectiveIslandData["steps"][number]["status"], order: row.step_order, updatedAt: row.updated_at,
    })) } }
  } catch (error) { return failure(error) }
}
export async function createIslandObjective(scope: ObjectiveScope, title: string): Promise<ObjectiveMutationResult> {
  try {
    await actor(scope, true)
    const result = await createWorkspaceObjectiveAction({ title: titleSchema.parse(title) })
    return result.ok ? { ok: true } : result
  } catch (error) { return failure(error) }
}
export async function editIslandObjective(scope: ObjectiveScope, input: ObjectiveEdit): Promise<ObjectiveMutationResult> {
  try {
    const { client, orgId, userId } = await actor(scope, true)
    const value = editSchema.parse(input)
    const { data, error } = await client.from("organization_workspace_objectives").update({
      title: value.title, description: value.description.trim() || null, status: value.status,
      completed_at: value.status === "done" ? new Date().toISOString() : null, updated_by: userId,
    }).eq("org_id", orgId).eq("id", value.id).eq("kind", "custom")
      .eq("updated_at", value.expectedUpdatedAt).select("id").maybeSingle()
    if (error) throw new Error("Unable to save the objective.")
    if (!data) throw new Error("This objective changed or is managed by its source. Refresh before editing again.")
    return { ok: true }
  } catch (error) { return failure(error) }
}
export async function setIslandStep(scope: ObjectiveScope, input: { id: string; objectiveId: string; expectedUpdatedAt: string; done: boolean }): Promise<ObjectiveMutationResult> {
  try {
    const { client, orgId } = await actor(scope, true)
    const value = z.object({ id: z.uuid(), objectiveId: z.uuid(), expectedUpdatedAt: z.string().min(1), done: z.boolean() }).parse(input)
    const parent = await client.from("organization_workspace_objectives").select("kind")
      .eq("org_id", orgId).eq("id", value.objectiveId).maybeSingle()
    if (parent.error || parent.data?.kind !== "custom") throw new Error("Update this step from its source lesson or document.")
    const { data, error } = await client.from("organization_workspace_objective_steps")
      .update({ status: value.done ? "done" : "todo", completed_at: value.done ? new Date().toISOString() : null })
      .eq("org_id", orgId).eq("objective_id", value.objectiveId).eq("id", value.id)
      .eq("step_type", "custom").eq("updated_at", value.expectedUpdatedAt).select("id").maybeSingle()
    if (error) throw new Error("Unable to save the step.")
    if (!data) throw new Error("This step changed or is managed by its source. Refresh before editing again.")
    return { ok: true }
  } catch (error) { return failure(error) }
}
