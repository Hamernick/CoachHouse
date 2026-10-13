"use server"

import { isOrdinaryWorkspaceProject } from "@/lib/workspace/ordinary-project-access"

import { mergeProjectOptions } from "../lib/project-fiscal-sponsorship"

import { resolveProjectCreateOrgId } from "./project-organization"

import { parseScheduleDay } from "../lib/project-schedule"

import { revalidatePath } from "next/cache"

import type { Database } from "@/lib/supabase"
import type { MemberWorkspaceCreateProjectFormInput } from "../types"
import {
  actorCanAccessOrganization,
  actorCanAccessOrganizations,
} from "./member-workspace-actor-permissions"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import { loadOrganizationProjectStarterIdMap } from "./project-persistence"
import { buildStarterOrganizationProjects } from "./project-starter-data"
import {
  buildStarterOrganizationTaskAssignees,
  buildStarterOrganizationTasks,
} from "./task-starter-data"
import { MEMBER_WORKSPACE_STARTER_VERSION } from "./starter-data"
import { normalizeMemberWorkspaceCreateProjectInput } from "./project-create-input"
import { ensureMemberWorkspaceFeatureAccess } from "./access"
import {
  isMissingOrganizationProjectsTableError,
  isMissingOrganizationWorkspaceStarterStateTableError,
} from "./table-errors"
import { buildProjectOverviewDocumentContent } from "./project-overview-documents"
import { transitionOrganizationProjectDeletion } from "./project-deletion-transition-support"
import {
  transitionOrganizationProjectCreation,
  transitionOrganizationProjectSchedule,
  transitionOrganizationProjectStatus,
  transitionOrganizationProjectUpdate,
} from "./project-transition-support"

export type MemberWorkspaceResetStarterProjectsResult =
  | { ok: true }
  | { error: string }

export type MemberWorkspaceClearStarterDataResult =
  | { ok: true }
  | { error: string }

export type MemberWorkspaceCreateProjectResult =
  | { ok: true; id: string }
  | { error: string }

export type MemberWorkspaceDeleteProjectResult =
  | { ok: true; id: string }
  | { error: string }

const PLATFORM_ADMIN_PROJECT_MUTATION_ERROR =
  "That project action is not available for platform admins."

function ensureProjectMutationAllowed(
  actor: Awaited<ReturnType<typeof resolveMemberWorkspaceActorContext>>,
  options: { allowPlatformAdmin?: boolean; platformAdminError?: string } = {}
) {
  const featureAccess = ensureMemberWorkspaceFeatureAccess(actor)
  if (featureAccess) return featureAccess

  if (actorCanAccessOrganizations(actor)) {
    if (options.allowPlatformAdmin) return null
    return {
      error:
        options.platformAdminError ?? PLATFORM_ADMIN_PROJECT_MUTATION_ERROR,
    } as const
  }

  if (!actor.canEdit) {
    return { error: "Only organization editors can manage projects." } as const
  }

  return null
}


export async function createMemberWorkspaceProjectAction(
  input: MemberWorkspaceCreateProjectFormInput
): Promise<MemberWorkspaceCreateProjectResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  const mutationAccessResult = ensureProjectMutationAllowed(actor, {
    allowPlatformAdmin: true,
  })
  if (mutationAccessResult) {
    return mutationAccessResult
  }
  const targetOrg = await resolveProjectCreateOrgId({ actor, input })
  if ("error" in targetOrg) return targetOrg

  const normalized = normalizeMemberWorkspaceCreateProjectInput(input)
  if (!normalized.ok) {
    return { error: normalized.error }
  }

  const payload = {
    org_id: targetOrg.orgId,
    organization_unassigned: input.orgId === null,
    project_kind: "standard",
    ...(normalized.value.recurrence === undefined ? {} : { recurrence: normalized.value.recurrence }),
    name: normalized.value.name,
    description: normalized.value.description,
    status: normalized.value.status,
    priority: normalized.value.priority,
    progress: 0,
    start_date: normalized.value.startDate,
    end_date: normalized.value.endDate,
    client_name: input.orgId === null ? null : normalized.value.clientName,
    type_label: normalized.value.typeLabel,
    duration_label: normalized.value.durationLabel,
    tags: normalized.value.tags,
    ...(normalized.value.optionSettings || input.fiscalSponsorshipEnabled ? { option_settings: mergeProjectOptions(undefined, normalized.value.optionSettings, input.fiscalSponsorshipEnabled) } : {}),
    member_labels: normalized.value.memberLabels,
    task_count: 0,
    created_source: "user",
    created_by: actor.userId,
    updated_by: actor.userId,
  }

  const overviewDocument = normalized.value.hasOverviewDocumentHtml
    ? buildProjectOverviewDocumentContent(normalized.value.overviewDocumentHtml)
    : null
  const transition = await transitionOrganizationProjectCreation({
    actorId: actor.userId,
    hasOverviewDocument: normalized.value.hasOverviewDocumentHtml,
    orgId: targetOrg.orgId,
    overviewDocumentHtml: overviewDocument?.documentHtml ?? null,
    overviewDocumentText: overviewDocument?.documentText ?? null,
    project: payload,
  })
  if ("error" in transition) return transition

  revalidatePath("/organizations")
  revalidatePath("/admin/dashboard")
  revalidatePath("/projects")
  return { ok: true, id: transition.projectId }
}

export async function updateMemberWorkspaceProjectAction(
  projectId: string,
  input: MemberWorkspaceCreateProjectFormInput
): Promise<MemberWorkspaceCreateProjectResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  if (!(await isOrdinaryWorkspaceProject({ supabase: actor.supabase, userId: actor.userId, projectId }))) return { error: "Use the fiscal application review for this project." }
  const mutationAccessResult = ensureProjectMutationAllowed(actor, {
    allowPlatformAdmin: true,
  })
  if (mutationAccessResult) {
    return mutationAccessResult
  }

  const normalized = normalizeMemberWorkspaceCreateProjectInput(input)
  if (!normalized.ok) {
    return { error: normalized.error }
  }

  const { data: existingProject, error: existingProjectError } =
    await actor.supabase
      .from("organization_projects")
      .select("id, org_id, updated_at, recurrence, option_settings")
      .eq("id", projectId)
      .maybeSingle<{ id: string; org_id: string; updated_at: string; recurrence: string; option_settings?: import("@/lib/supabase").Json }>()

  if (existingProjectError || !existingProject) {
    if (
      existingProjectError &&
      isMissingOrganizationProjectsTableError(existingProjectError)
    ) {
      return {
        error:
          "Organizations are not available until the latest workspace database migrations are applied.",
      }
    }
    return { error: "Unable to find that project." }
  }

  if (!actorCanAccessOrganization(actor, existingProject.org_id)) {
    return {
      error: "You do not have access to that organization's projects.",
    }
  }

  if (input.orgId && input.orgId !== existingProject.org_id) {
    return { error: "Changing a project's owning organization is not supported. You can remove its organization assignment." }
  }

  if ((input.recurrence ?? existingProject.recurrence) === "monthly" &&
      (!normalized.value.startDate || !normalized.value.endDate)) {
    return { error: "Monthly projects require a start date and an end date." }
  }

  const payload = {
    ...(input.orgId === undefined ? {} : { organization_unassigned: input.orgId === null }),
    ...(normalized.value.recurrence === undefined ? {} : { recurrence: normalized.value.recurrence }),
    name: normalized.value.name,
    description: normalized.value.description,
    status: normalized.value.status,
    priority: normalized.value.priority,
    start_date: normalized.value.startDate,
    end_date: normalized.value.endDate,
    client_name: input.orgId === null ? null : normalized.value.clientName,
    type_label: normalized.value.typeLabel,
    duration_label: normalized.value.durationLabel,
    tags: normalized.value.tags,
    ...(normalized.value.optionSettings || input.fiscalSponsorshipEnabled ? { option_settings: mergeProjectOptions(existingProject.option_settings, normalized.value.optionSettings, input.fiscalSponsorshipEnabled) } : {}),
    member_labels: normalized.value.memberLabels,
    updated_by: actor.userId,
  }

  const overviewDocument = normalized.value.hasOverviewDocumentHtml
    ? buildProjectOverviewDocumentContent(normalized.value.overviewDocumentHtml)
    : null
  const transition = await transitionOrganizationProjectUpdate({
    actorId: actor.userId,
    expectedOrgId: existingProject.org_id,
    expectedUpdatedAt: existingProject.updated_at,
    hasOverviewDocument: normalized.value.hasOverviewDocumentHtml,
    overviewDocumentHtml: overviewDocument?.documentHtml ?? null,
    overviewDocumentText: overviewDocument?.documentText ?? null,
    project: payload,
    projectId,
  })
  if ("error" in transition) return transition

  revalidatePath("/organizations")
  revalidatePath("/admin/dashboard")
  revalidatePath("/projects")
  revalidatePath(`/organizations/${projectId}`)
  revalidatePath(`/projects/${projectId}`)
  return { ok: true, id: projectId }
}

export async function updateMemberWorkspaceProjectStatusAction(
  projectId: string,
  status: Database["public"]["Tables"]["organization_projects"]["Update"]["status"]
): Promise<MemberWorkspaceCreateProjectResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  if (!(await isOrdinaryWorkspaceProject({ supabase: actor.supabase, userId: actor.userId, projectId }))) return { error: "Use the fiscal application review for this project." }
  const mutationAccessResult = ensureProjectMutationAllowed(actor, {
    allowPlatformAdmin: true,
  })
  if (mutationAccessResult) {
    return mutationAccessResult
  }
  if (!status) return { error: "Choose a valid project status." }

  const { data: existingProject, error: existingProjectError } =
    await actor.supabase
      .from("organization_projects")
      .select("id, org_id, updated_at")
      .eq("id", projectId)
      .maybeSingle<{ id: string; org_id: string; updated_at: string }>()

  if (existingProjectError || !existingProject) {
    if (
      existingProjectError &&
      isMissingOrganizationProjectsTableError(existingProjectError)
    ) {
      return {
        error:
          "Organizations are not available until the latest workspace database migrations are applied.",
      }
    }
    return { error: "Unable to find that project." }
  }

  if (!actorCanAccessOrganization(actor, existingProject.org_id)) {
    return {
      error: "You do not have access to that organization's projects.",
    }
  }

  const transition = await transitionOrganizationProjectStatus({
    actorId: actor.userId,
    expectedOrgId: existingProject.org_id,
    expectedUpdatedAt: existingProject.updated_at,
    projectId,
    status,
  })
  if ("error" in transition) return transition

  revalidatePath("/organizations")
  revalidatePath("/admin/dashboard")
  revalidatePath("/projects")
  revalidatePath(`/organizations/${projectId}`)
  revalidatePath(`/projects/${projectId}`)
  return { ok: true, id: projectId }
}

export async function updateMemberWorkspaceProjectScheduleAction(
  projectId: string,
  startDate: string,
  endDate: string
): Promise<MemberWorkspaceCreateProjectResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  if (!(await isOrdinaryWorkspaceProject({ supabase: actor.supabase, userId: actor.userId, projectId }))) return { error: "Use the fiscal application review for this project." }
  const mutationAccessResult = ensureProjectMutationAllowed(actor, {
    allowPlatformAdmin: true,
  })
  if (mutationAccessResult) {
    return mutationAccessResult
  }

  const normalizedProjectId = projectId.trim()
  if (!normalizedProjectId) {
    return { error: "Choose a project." }
  }

  const normalizedStartDate = startDate.trim() || null
  const normalizedEndDate = endDate.trim() || null
  const startDay = normalizedStartDate ? parseScheduleDay(normalizedStartDate) : null
  const endDay = normalizedEndDate ? parseScheduleDay(normalizedEndDate) : null
  if ((normalizedStartDate && startDay === null) || (normalizedEndDate && endDay === null)) {
    return { error: "Enter valid project dates." }
  }
  if (endDay !== null && startDay !== null && endDay < startDay) {
    return { error: "End date must be on or after the start date." }
  }

  const { data: existingProject, error: existingProjectError } =
    await actor.supabase
      .from("organization_projects")
      .select("id, org_id, updated_at, recurrence")
      .eq("id", normalizedProjectId)
      .maybeSingle<{ id: string; org_id: string; updated_at: string; recurrence: string }>()

  if (existingProjectError || !existingProject) {
    if (
      existingProjectError &&
      isMissingOrganizationProjectsTableError(existingProjectError)
    ) {
      return {
        error:
          "Organizations are not available until the latest workspace database migrations are applied.",
      }
    }
    return { error: "Unable to load the schedule. Refresh or check that workspace migrations are applied." }
  }

  if (!actorCanAccessOrganization(actor, existingProject.org_id)) {
    return {
      error: "You do not have access to that organization's projects.",
    }
  }

  if (existingProject.recurrence === "monthly" && (!normalizedStartDate || !normalizedEndDate)) {
    return { error: "Monthly projects require a start date and an end date." }
  }

  const transition = await transitionOrganizationProjectSchedule({
    actorId: actor.userId,
    endDate: normalizedEndDate,
    expectedOrgId: existingProject.org_id,
    expectedUpdatedAt: existingProject.updated_at,
    projectId: normalizedProjectId,
    startDate: normalizedStartDate,
  })
  if ("error" in transition) return transition

  revalidatePath("/organizations")
  revalidatePath("/admin/dashboard")
  revalidatePath("/projects")
  revalidatePath(`/organizations/${normalizedProjectId}`)
  revalidatePath(`/projects/${normalizedProjectId}`)
  return { ok: true, id: normalizedProjectId }
}

export async function deleteMemberWorkspaceProjectAction(
  projectId: string
): Promise<MemberWorkspaceDeleteProjectResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  if (!(await isOrdinaryWorkspaceProject({ supabase: actor.supabase, userId: actor.userId, projectId }))) return { error: "Use the fiscal application review for this project." }
  const mutationAccessResult = ensureProjectMutationAllowed(actor, {
    allowPlatformAdmin: true,
  })
  if (mutationAccessResult) {
    return mutationAccessResult
  }

  const normalizedProjectId = projectId.trim()
  if (!normalizedProjectId) {
    return { error: "Choose a project to delete." }
  }

  const { data: existingProject, error: existingProjectError } =
    await actor.supabase
      .from("organization_projects")
      .select("id, org_id, project_kind, canonical_org_id, updated_at")
      .eq("id", normalizedProjectId)
      .maybeSingle<{
        id: string
        org_id: string
        project_kind: string
        canonical_org_id: string | null
        updated_at: string
      }>()

  if (existingProjectError || !existingProject) {
    if (
      existingProjectError &&
      isMissingOrganizationProjectsTableError(existingProjectError)
    ) {
      return {
        error:
          "Organizations are not available until the latest workspace database migrations are applied.",
      }
    }
    return { error: "Unable to find that project." }
  }

  if (!actorCanAccessOrganization(actor, existingProject.org_id)) {
    return {
      error: "You do not have access to that organization's projects.",
    }
  }

  if (
    existingProject.project_kind !== "standard" ||
    existingProject.canonical_org_id
  ) {
    return {
      error:
        "Canonical organization records cannot be deleted from this screen.",
    }
  }

  const transition = await transitionOrganizationProjectDeletion({
    actorId: actor.userId,
    expectedOrgId: existingProject.org_id,
    expectedUpdatedAt: existingProject.updated_at,
    projectId: normalizedProjectId,
  })
  if ("error" in transition && typeof transition.error === "string") {
    return { error: transition.error }
  }

  revalidatePath("/organizations")
  revalidatePath("/admin/dashboard")
  revalidatePath("/projects")
  revalidatePath(`/organizations/${normalizedProjectId}`)
  revalidatePath(`/projects/${normalizedProjectId}`)
  return { ok: true, id: normalizedProjectId }
}

export async function resetMemberWorkspaceStarterProjectsAction(): Promise<MemberWorkspaceResetStarterProjectsResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  const featureAccess = ensureMemberWorkspaceFeatureAccess(actor)
  if (featureAccess) return featureAccess

  if (actorCanAccessOrganizations(actor) || !actor.canEdit) {
    return { error: "Only organization editors can reset starter data." }
  }

  const { error: deleteTasksError } = await actor.supabase
    .from("organization_tasks")
    .delete()
    .eq("org_id", actor.activeOrg.orgId)
    .eq("created_source", "starter_seed")

  if (deleteTasksError) {
    return { error: "Unable to clear starter tasks." }
  }

  const { error: deleteError } = await actor.supabase
    .from("organization_projects")
    .delete()
    .eq("org_id", actor.activeOrg.orgId)
    .eq("created_source", "starter_seed")

  if (deleteError) {
    return { error: "Unable to clear starter projects." }
  }

  const starterProjects = buildStarterOrganizationProjects({
    orgId: actor.activeOrg.orgId,
    actorId: actor.userId,
  })

  const { error: insertError } = await actor.supabase
    .from("organization_projects")
    .upsert(starterProjects, { onConflict: "org_id,starter_seed_key" })

  if (insertError) {
    return { error: "Unable to restore starter projects." }
  }

  const projectIdByStarterKey = await loadOrganizationProjectStarterIdMap({
    orgId: actor.activeOrg.orgId,
    supabase: actor.supabase,
  })

  const starterTasks = buildStarterOrganizationTasks({
    orgId: actor.activeOrg.orgId,
    actorId: actor.userId,
    projectIdByStarterKey,
  })

  const { data: upsertedTasks, error: starterTasksError } = await actor.supabase
    .from("organization_tasks")
    .upsert(starterTasks, { onConflict: "org_id,starter_seed_key" })
    .select("id, starter_seed_key")
    .returns<Array<{ id: string; starter_seed_key: string | null }>>()

  if (starterTasksError) {
    return { error: "Unable to restore starter tasks." }
  }

  const taskIdByStarterKey = new Map<string, string>()
  for (const row of upsertedTasks ?? []) {
    if (!row.starter_seed_key) continue
    taskIdByStarterKey.set(row.starter_seed_key, row.id)
  }

  const starterTaskAssignees = buildStarterOrganizationTaskAssignees({
    orgId: actor.activeOrg.orgId,
    actorId: actor.userId,
    assigneeUserId: actor.userId,
    taskIdByStarterKey,
  })

  const { error: starterTaskAssigneesError } = await actor.supabase
    .from("organization_task_assignees")
    .upsert(starterTaskAssignees, { onConflict: "task_id,user_id" })

  if (starterTaskAssigneesError) {
    return { error: "Unable to restore starter task assignments." }
  }

  const { error: starterStateError } = await actor.supabase
    .from("organization_workspace_starter_state")
    .upsert(
      {
        org_id: actor.activeOrg.orgId,
        seed_version: MEMBER_WORKSPACE_STARTER_VERSION,
        seeded_at: new Date().toISOString(),
        last_reset_at: new Date().toISOString(),
        updated_by: actor.userId,
      },
      { onConflict: "org_id" }
    )

  if (starterStateError) {
    return { error: "Unable to update starter state." }
  }

  revalidatePath("/organizations")
  revalidatePath("/admin/dashboard")
  revalidatePath("/projects")
  revalidatePath("/tasks")
  return { ok: true }
}

export async function clearMemberWorkspaceStarterDataAction(): Promise<MemberWorkspaceClearStarterDataResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  const featureAccess = ensureMemberWorkspaceFeatureAccess(actor)
  if (featureAccess) return featureAccess

  if (actorCanAccessOrganizations(actor) || !actor.canEdit) {
    return { error: "Only organization editors can clear demo data." }
  }

  const timestamp = new Date().toISOString()
  const { error: starterStateError } = await actor.supabase
    .from("organization_workspace_starter_state")
    .upsert(
      {
        org_id: actor.activeOrg.orgId,
        seed_version: MEMBER_WORKSPACE_STARTER_VERSION,
        seeded_at: timestamp,
        last_reset_at: timestamp,
        updated_by: actor.userId,
      },
      { onConflict: "org_id" }
    )

  if (
    starterStateError &&
    !isMissingOrganizationWorkspaceStarterStateTableError(starterStateError)
  ) {
    return { error: "Unable to update starter-data state." }
  }

  const { error: deleteTasksError } = await actor.supabase
    .from("organization_tasks")
    .delete()
    .eq("org_id", actor.activeOrg.orgId)
    .eq("created_source", "starter_seed")

  if (deleteTasksError) {
    return { error: "Unable to clear demo tasks." }
  }

  const { error: deleteProjectsError } = await actor.supabase
    .from("organization_projects")
    .delete()
    .eq("org_id", actor.activeOrg.orgId)
    .eq("project_kind", "standard")
    .eq("created_source", "starter_seed")

  if (deleteProjectsError) {
    return { error: "Unable to clear demo organizations." }
  }

  revalidatePath("/organizations")
  revalidatePath("/admin/dashboard")
  revalidatePath("/projects")
  revalidatePath("/tasks")
  return { ok: true }
}
