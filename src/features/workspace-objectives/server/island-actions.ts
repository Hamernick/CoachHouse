import "server-only"
import { readObjectivePlans } from "./plan-actions"
import { z } from "zod"
import { objectiveActor } from "./objective-actor"
import { createWorkspaceObjectiveAction, loadWorkspaceObjectivesAction } from "./actions"
import type { ObjectiveEdit, ObjectiveIslandData, ObjectiveMutationResult, ObjectiveScope } from "../island-types"

const titleSchema = z.string().trim().min(1, "Enter an objective.").max(240)
const editSchema = z.object({
  id: z.uuid(), expectedUpdatedAt: z.string().min(1), title: titleSchema,
  description: z.string().max(10000), status: z.enum(["todo", "in_progress", "blocked", "done", "archived"]),
})
function failure(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof z.ZodError ? "Check the objective details." : error instanceof Error ? error.message : "Unable to update objectives." }
}
export async function loadObjectiveIsland(scope: ObjectiveScope): Promise<{ ok: true; data: ObjectiveIslandData } | { ok: false; error: string }> {
  try {
    const { client, orgId } = await objectiveActor(scope)
    const collection = await loadWorkspaceObjectivesAction()
    if (!collection.ok) return collection
    if (collection.data.loadedFrom !== "normalized") return { ok: true, data: { ...collection.data, steps: [] } }
    const { data, error } = await client.from("organization_workspace_objective_steps")
      .select("id, objective_id, title, status, step_type, step_order, updated_at").eq("org_id", orgId).order("step_order")
    if (error) throw new Error("Unable to load objective steps.")
    return { ok: true, data: { ...collection.data, planning: await readObjectivePlans(client, orgId), steps: (data ?? []).map(row => ({
      editable: row.step_type === "custom", id: row.id, objectiveId: row.objective_id, title: row.title,
      status: row.status as ObjectiveIslandData["steps"][number]["status"], order: row.step_order, updatedAt: row.updated_at,
    })) } }
  } catch (error) { return failure(error) }
}
export async function createIslandObjective(scope: ObjectiveScope, title: string): Promise<ObjectiveMutationResult> {
  try {
    await objectiveActor(scope, true)
    const result = await createWorkspaceObjectiveAction({ title: titleSchema.parse(title) })
    return result.ok ? { ok: true } : result
  } catch (error) { return failure(error) }
}
function assertSaved(data: unknown, error: { code?: string } | null) {
  if (error?.code === "40001") throw new Error("This objective or step changed. Refresh before editing again.")
  if (error?.code === "42501") throw new Error("Access changed or this item is managed by its source. Reopen Objectives.")
  if (error || data !== true) throw new Error("Unable to confirm the save. Reopen Objectives before trying again.")
}
export async function editIslandObjective(scope: ObjectiveScope, input: ObjectiveEdit): Promise<ObjectiveMutationResult> {
  try {
    const { client, orgId } = await objectiveActor(scope, true)
    const value = editSchema.parse(input)
    const { data, error } = await client.rpc("write_workspace_objective_island", {
      p_org_id: orgId, p_objective_id: value.id, p_step_id: null,
      p_expected_updated_at: value.expectedUpdatedAt, p_title: value.title,
      p_description: value.description, p_status: value.status,
    })
    assertSaved(data, error)
    return { ok: true }
  } catch (error) { return failure(error) }
}
export async function setIslandStep(scope: ObjectiveScope, input: { id: string; objectiveId: string; expectedUpdatedAt: string; done: boolean }): Promise<ObjectiveMutationResult> {
  try {
    const { client, orgId } = await objectiveActor(scope, true)
    const value = z.object({ id: z.uuid(), objectiveId: z.uuid(), expectedUpdatedAt: z.string().min(1), done: z.boolean() }).parse(input)
    const { data, error } = await client.rpc("write_workspace_objective_island", {
      p_org_id: orgId, p_objective_id: value.objectiveId, p_step_id: value.id,
      p_expected_updated_at: value.expectedUpdatedAt, p_title: null,
      p_description: null, p_status: value.done ? "done" : "todo",
    })
    assertSaved(data, error)
    return { ok: true }
  } catch (error) { return failure(error) }
}
