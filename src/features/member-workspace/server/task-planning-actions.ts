"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { MemberWorkspaceMoveTaskInput, MemberWorkspaceScheduleTaskInput } from "../types"
import { ensureMemberWorkspaceFeatureAccess } from "./access"
import { actorCanAccessOrganizations } from "./member-workspace-actor-permissions"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import { resolveTaskTargetProject } from "./task-action-helpers"
import { resolveDirectoryTaskScope } from "./task-directory-scope"

const day = z.string().refine((value) => {
  if (value === "") return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
})
const scheduleSchema = z.object({
  taskId: z.string().uuid(), projectId: z.string().uuid(), startDate: day,
  expectedStartDate: day, expectedEndDate: day,
})
const moveSchema = z.object({
  taskId: z.string().uuid(), projectId: z.string().uuid(), neighborTaskId: z.string().uuid(),
  placement: z.enum(["before", "after"]), expectedSortOrder: z.number().int(),
  expectedNeighborSortOrder: z.number().int(), expectedUpdatedAt: z.string().datetime({ offset: true }),
  expectedNeighborUpdatedAt: z.string().datetime({ offset: true }),
})

async function resolvePlanningProject(projectId: string) {
  const actor = await resolveMemberWorkspaceActorContext(await resolveDirectoryTaskScope())
  const access = ensureMemberWorkspaceFeatureAccess(actor)
  if (access) return access
  if (!actorCanAccessOrganizations(actor) && !actor.canEdit) {
    return { error: "You do not have access to edit tasks." }
  }
  const result = await resolveTaskTargetProject({ actor, projectId })
  if ("error" in result) return result
  return { actor, project: result.project }
}

function revalidateTaskViews(projectId: string) {
  for (const path of ["/tasks", "/projects", "/organizations", "/admin/dashboard", `/projects/${projectId}`, `/organizations/${projectId}`]) {
    revalidatePath(path)
  }
}

function planningFailure(code?: string) {
  if (code === "stale") return { error: "This task changed. Refresh and try again." }
  if (code === "invalid_dates") return { error: "Start date cannot be after the deadline. Open the task to edit both dates." }
  if (code === "task_not_found" || code === "invalid_task") return { error: "You cannot change the schedule or order of that task." }
  return { error: "Unable to save this task change. Refresh before trying again." }
}

export async function scheduleMemberWorkspaceTaskAction(input: MemberWorkspaceScheduleTaskInput) {
  const parsed = scheduleSchema.safeParse(input)
  if (!parsed.success) return { error: "Choose a valid task and calendar date." }
  const context = await resolvePlanningProject(parsed.data.projectId)
  if ("error" in context) return context
  const { data, error } = await createSupabaseAdminClient({ actorId: context.actor.userId }).rpc("schedule_organization_task_transition", {
    p_actor_id: context.actor.userId, p_task_id: parsed.data.taskId,
    p_project_id: context.project.id, p_expected_org_id: context.project.org_id,
    p_start_date: parsed.data.startDate || null,
    p_expected_start_date: parsed.data.expectedStartDate || null,
    p_expected_end_date: parsed.data.expectedEndDate || null,
  })
  const result = z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), startDate: day.nullable(), endDate: day.nullable() }),
    z.object({ ok: z.literal(false), code: z.string() }),
  ]).safeParse(data)
  if (error || !result.success) return planningFailure()
  if (!result.data.ok) return planningFailure(result.data.code)
  revalidateTaskViews(context.project.id)
  return { ok: true as const, taskId: parsed.data.taskId, startDate: result.data.startDate ?? "", endDate: result.data.endDate ?? "" }
}

export async function moveMemberWorkspaceTaskAction(input: MemberWorkspaceMoveTaskInput) {
  const parsed = moveSchema.safeParse(input)
  if (!parsed.success || parsed.data.taskId === parsed.data.neighborTaskId) return { error: "Choose valid tasks to reorder." }
  const context = await resolvePlanningProject(parsed.data.projectId)
  if ("error" in context) return context
  const { data, error } = await createSupabaseAdminClient({ actorId: context.actor.userId }).rpc("move_organization_task_transition", {
    p_actor_id: context.actor.userId, p_task_id: parsed.data.taskId,
    p_project_id: context.project.id, p_expected_org_id: context.project.org_id,
    p_neighbor_task_id: parsed.data.neighborTaskId, p_placement: parsed.data.placement,
    p_expected_sort_order: parsed.data.expectedSortOrder,
    p_expected_neighbor_sort_order: parsed.data.expectedNeighborSortOrder,
    p_expected_updated_at: parsed.data.expectedUpdatedAt,
    p_expected_neighbor_updated_at: parsed.data.expectedNeighborUpdatedAt,
  })
  const result = z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), projectId: z.string().uuid() }),
    z.object({ ok: z.literal(false), code: z.string() }),
  ]).safeParse(data)
  if (error || !result.success) return planningFailure()
  if (!result.data.ok) return planningFailure(result.data.code)
  if (result.data.projectId !== context.project.id) return planningFailure()
  revalidateTaskViews(context.project.id)
  return { ok: true as const, projectId: context.project.id }
}
