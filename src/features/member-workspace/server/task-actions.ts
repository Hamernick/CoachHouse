"use server"

import { revalidatePath } from "next/cache"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type {
  MemberWorkspaceCreateTaskInput,
  MemberWorkspaceTaskStatus,
} from "../types"
import { ensureMemberWorkspaceFeatureAccess } from "./access"
import { actorCanAccessOrganizations } from "./member-workspace-actor-permissions"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import {
  VALID_TASK_PRIORITIES,
  VALID_TASK_STATUSES,
  formatTaskType,
  resolveAssignableUserId,
  resolveTaskTargetProject,
  toDateOnly,
} from "./task-action-helpers"
import {
  createMemberWorkspaceTaskTransition,
  deleteMemberWorkspaceTaskTransition,
  reorderMemberWorkspaceTasksTransition,
  updateMemberWorkspaceTaskTransition,
} from "./task-transition-support"

export type MemberWorkspaceUpdateTaskStatusResult =
  | { ok: true; taskId: string; status: MemberWorkspaceTaskStatus }
  | { error: string }

export type MemberWorkspaceCreateTaskResult =
  | { ok: true; taskId: string }
  | { error: string }

export type MemberWorkspaceUpdateTaskResult =
  | { ok: true; taskId: string }
  | { error: string }

export type MemberWorkspaceUpdateTaskOrderResult =
  | { ok: true; projectId: string }
  | { error: string }

export type MemberWorkspaceDeleteTaskResult =
  | { ok: true; taskId: string; projectId: string }
  | { error: string }

export async function createMemberWorkspaceTaskAction(
  input: MemberWorkspaceCreateTaskInput,
  actorScope: "workspace" | "platform" = "workspace"
): Promise<MemberWorkspaceCreateTaskResult> {
  const actor = await resolveMemberWorkspaceActorContext(actorScope)
  const featureAccess = ensureMemberWorkspaceFeatureAccess(actor)
  if (featureAccess) return featureAccess

  if (!actorCanAccessOrganizations(actor) && !actor.canEdit) {
    return { error: "You do not have access to create tasks." }
  }

  const projectId = input.projectId.trim()
  const title = input.title.trim()

  if (!projectId) {
    return { error: "Choose a project." }
  }

  if (!title) {
    return { error: "Task title is required." }
  }

  if (!VALID_TASK_STATUSES.has(input.status)) {
    return { error: "Choose a valid task status." }
  }

  const priority = input.priority ?? "no-priority"
  if (!VALID_TASK_PRIORITIES.has(priority)) {
    return { error: "Choose a valid task priority." }
  }

  const startDate = input.startDate ? toDateOnly(input.startDate) : null
  const endDate = input.endDate ? toDateOnly(input.endDate) : null
  if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime()))) {
    return { error: "Enter valid task dates." }
  }
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    return { error: "Target date must be on or after the start date." }
  }

  const projectResult = await resolveTaskTargetProject({
    actor,
    projectId,
  })
  if ("error" in projectResult) {
    return projectResult
  }
  const { project } = projectResult

  const assigneeResult = await resolveAssignableUserId({
    actor,
    orgId: project.org_id,
    requestedUserId: input.assigneeUserId,
  })
  if ("error" in assigneeResult) {
    return assigneeResult
  }

  const result = await createMemberWorkspaceTaskTransition({
    actorId: actor.userId,
    assigneeId: assigneeResult.userId,
    description: input.description?.trim() || null,
    endDate: input.endDate,
    priority,
    projectId: project.id,
    startDate: input.startDate,
    status: input.status,
    tagLabel: input.tagLabel?.trim() || null,
    taskType: formatTaskType(input.tagLabel),
    title,
    workstreamName: input.workstreamName?.trim() || null,
  })
  if ("error" in result) return result

  revalidatePath("/admin/dashboard")
  revalidatePath("/projects")
  revalidatePath("/tasks")
  revalidatePath("/organizations")
  revalidatePath(`/organizations/${project.id}`)
  revalidatePath(`/projects/${project.id}`)

  return result
}

export async function updateMemberWorkspaceTaskAction(
  taskId: string,
  input: MemberWorkspaceCreateTaskInput,
  actorScope: "workspace" | "platform" = "workspace"
): Promise<MemberWorkspaceUpdateTaskResult> {
  const actor = await resolveMemberWorkspaceActorContext(actorScope)
  const featureAccess = ensureMemberWorkspaceFeatureAccess(actor)
  if (featureAccess) return featureAccess

  if (!actorCanAccessOrganizations(actor) && !actor.canEdit) {
    return { error: "You do not have access to edit tasks." }
  }

  const normalizedTaskId = taskId.trim()
  if (!normalizedTaskId) {
    return { error: "Choose a task." }
  }

  const projectId = input.projectId.trim()
  const title = input.title.trim()
  if (!projectId) {
    return { error: "Choose a project." }
  }
  if (!title) {
    return { error: "Task title is required." }
  }
  if (!VALID_TASK_STATUSES.has(input.status)) {
    return { error: "Choose a valid task status." }
  }

  const priority = input.priority ?? "no-priority"
  if (!VALID_TASK_PRIORITIES.has(priority)) {
    return { error: "Choose a valid task priority." }
  }

  const startDate = input.startDate ? toDateOnly(input.startDate) : null
  const endDate = input.endDate ? toDateOnly(input.endDate) : null
  if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime()))) {
    return { error: "Enter valid task dates." }
  }
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    return { error: "Target date must be on or after the start date." }
  }

  const taskQuery = actor.supabase
    .from("organization_tasks")
    .select("id, org_id, project_id")
    .eq("id", normalizedTaskId)

  const { data: existingTask, error: existingTaskError } =
    await (actorCanAccessOrganizations(actor)
      ? taskQuery.maybeSingle<{
          id: string
          org_id: string
          project_id: string
        }>()
      : taskQuery
          .eq("org_id", actor.activeOrg.orgId)
          .maybeSingle<{ id: string; org_id: string; project_id: string }>())

  if (existingTaskError || !existingTask) {
    return { error: "Task not found." }
  }

  const projectResult = await resolveTaskTargetProject({
    actor,
    projectId,
  })
  if ("error" in projectResult) {
    return projectResult
  }
  const { project } = projectResult

  if (existingTask.project_id !== project.id) {
    const existingProjectResult = await resolveTaskTargetProject({
      actor,
      projectId: existingTask.project_id,
    })
    if ("error" in existingProjectResult) {
      return existingProjectResult
    }
  }

  const assigneeResult = await resolveAssignableUserId({
    actor,
    orgId: project.org_id,
    requestedUserId: input.assigneeUserId,
  })
  if ("error" in assigneeResult) {
    return assigneeResult
  }

  const result = await updateMemberWorkspaceTaskTransition({
    actorId: actor.userId,
    assigneeId: assigneeResult.userId,
    description: input.description?.trim() || null,
    endDate: input.endDate,
    expectedOrgId: existingTask.org_id,
    expectedProjectId: existingTask.project_id,
    priority,
    projectId: project.id,
    startDate: input.startDate,
    status: input.status,
    tagLabel: input.tagLabel?.trim() || null,
    taskId: normalizedTaskId,
    taskType: formatTaskType(input.tagLabel),
    title,
    workstreamName: input.workstreamName?.trim() || null,
  })
  if ("error" in result) return result

  revalidatePath("/admin/dashboard")
  revalidatePath("/projects")
  revalidatePath("/tasks")
  revalidatePath("/organizations")
  revalidatePath(`/organizations/${existingTask.project_id}`)
  revalidatePath(`/projects/${existingTask.project_id}`)
  if (existingTask.project_id !== project.id) {
    revalidatePath(`/organizations/${project.id}`)
    revalidatePath(`/projects/${project.id}`)
  }

  return { ok: true, taskId: result.taskId }
}

export async function updateMemberWorkspaceTaskStatusAction(
  taskId: string,
  nextStatus: MemberWorkspaceTaskStatus,
  actorScope: "workspace" | "platform" = "workspace"
): Promise<MemberWorkspaceUpdateTaskStatusResult> {
  const normalizedTaskId = taskId.trim()

  if (!normalizedTaskId) {
    return { error: "Choose a task." }
  }

  if (!VALID_TASK_STATUSES.has(nextStatus)) {
    return { error: "Choose a valid task status." }
  }

  const actor = await resolveMemberWorkspaceActorContext(actorScope)
  const featureAccess = ensureMemberWorkspaceFeatureAccess(actor)
  if (featureAccess) return featureAccess

  let canUpdateTask = actorCanAccessOrganizations(actor) || actor.canEdit

  if (!canUpdateTask) {
    const { data: assignment, error: assignmentError } = await actor.supabase
      .from("organization_task_assignees")
      .select("task_id")
      .eq("org_id", actor.activeOrg.orgId)
      .eq("user_id", actor.userId)
      .eq("task_id", normalizedTaskId)
      .maybeSingle()

    if (assignmentError) {
      return { error: "Unable to verify task access." }
    }

    canUpdateTask = !!assignment
  }

  if (!canUpdateTask) {
    return { error: "You do not have access to update that task." }
  }

  const taskQuery = actor.supabase
    .from("organization_tasks")
    .select("id, org_id, project_id, status")
    .eq("id", normalizedTaskId)

  const { data: task, error: taskError } = await (actorCanAccessOrganizations(
    actor
  )
    ? taskQuery.maybeSingle<{
        id: string
        org_id: string
        project_id: string
        status: string
      }>()
    : taskQuery.eq("org_id", actor.activeOrg.orgId).maybeSingle<{
        id: string
        org_id: string
        project_id: string
        status: string
      }>())

  if (taskError || !task) {
    return { error: "Task not found." }
  }

  const projectResult = await resolveTaskTargetProject({
    actor,
    projectId: task.project_id,
    assignedTaskId: task.id,
  })
  if ("error" in projectResult) {
    return projectResult
  }

  if (task.status === nextStatus) {
    return { ok: true, taskId: normalizedTaskId, status: nextStatus }
  }

  const admin = createSupabaseAdminClient()
  const { error: updateError } = await admin
    .from("organization_tasks")
    .update({
      status: nextStatus,
      updated_by: actor.userId,
    })
    .eq("id", normalizedTaskId)
    .eq("org_id", task.org_id)

  if (updateError) {
    return { error: "Unable to update task status." }
  }

  revalidatePath("/admin/dashboard")
  revalidatePath("/projects")
  revalidatePath("/tasks")
  revalidatePath("/organizations")
  revalidatePath(`/organizations/${task.project_id}`)
  revalidatePath(`/projects/${task.project_id}`)

  return { ok: true, taskId: normalizedTaskId, status: nextStatus }
}

export async function updateMemberWorkspaceTaskOrderAction(
  projectId: string,
  orderedTaskIds: string[]
): Promise<MemberWorkspaceUpdateTaskOrderResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  const featureAccess = ensureMemberWorkspaceFeatureAccess(actor)
  if (featureAccess) return featureAccess

  if (!actorCanAccessOrganizations(actor) && !actor.canEdit) {
    return { error: "You do not have access to reorder tasks." }
  }

  const normalizedProjectId = projectId.trim()
  if (!normalizedProjectId) {
    return { error: "Choose a project." }
  }

  const normalizedTaskIds = Array.from(
    new Set(orderedTaskIds.map((taskId) => taskId.trim()).filter(Boolean))
  )

  if (normalizedTaskIds.length === 0) {
    return { error: "Choose at least one task to reorder." }
  }

  const projectResult = await resolveTaskTargetProject({
    actor,
    projectId: normalizedProjectId,
  })
  if ("error" in projectResult) {
    return projectResult
  }

  const { project } = projectResult
  const result = await reorderMemberWorkspaceTasksTransition({
    actorId: actor.userId,
    expectedOrgId: project.org_id,
    orderedTaskIds: normalizedTaskIds,
    projectId: project.id,
  })
  if ("error" in result) return result

  revalidatePath("/admin/dashboard")
  revalidatePath("/projects")
  revalidatePath("/tasks")
  revalidatePath(`/organizations/${project.id}`)
  revalidatePath(`/projects/${project.id}`)

  return result
}

export async function deleteMemberWorkspaceTaskAction(
  taskId: string
): Promise<MemberWorkspaceDeleteTaskResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  const featureAccess = ensureMemberWorkspaceFeatureAccess(actor)
  if (featureAccess) return featureAccess

  if (!actorCanAccessOrganizations(actor) && !actor.canEdit) {
    return { error: "You do not have access to delete tasks." }
  }

  const normalizedTaskId = taskId.trim()
  if (!normalizedTaskId) {
    return { error: "Choose a task." }
  }

  const taskQuery = actor.supabase
    .from("organization_tasks")
    .select("id, org_id, project_id")
    .eq("id", normalizedTaskId)

  const { data: task, error: taskError } = await (actorCanAccessOrganizations(
    actor
  )
    ? taskQuery.maybeSingle<{
        id: string
        org_id: string
        project_id: string
      }>()
    : taskQuery
        .eq("org_id", actor.activeOrg.orgId)
        .maybeSingle<{ id: string; org_id: string; project_id: string }>())

  if (taskError || !task) {
    return { error: "Task not found." }
  }

  const projectResult = await resolveTaskTargetProject({
    actor,
    projectId: task.project_id,
  })
  if ("error" in projectResult) {
    return projectResult
  }

  const result = await deleteMemberWorkspaceTaskTransition({
    actorId: actor.userId,
    expectedOrgId: task.org_id,
    expectedProjectId: task.project_id,
    taskId: normalizedTaskId,
  })
  if ("error" in result) return result

  revalidatePath("/admin/dashboard")
  revalidatePath("/projects")
  revalidatePath("/tasks")
  revalidatePath("/organizations")
  revalidatePath(`/organizations/${task.project_id}`)
  revalidatePath(`/projects/${task.project_id}`)

  return result
}
