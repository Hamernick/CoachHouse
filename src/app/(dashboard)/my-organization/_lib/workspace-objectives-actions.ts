"use server"

import { canEditOrganization } from "@/lib/organization/active-org"

import {
  asWorkspaceObjectiveActionError,
  mapLegacyTrackerStateToObjectiveCollection,
  normalizeWorkspaceObjectiveCreateInput,
  normalizeWorkspaceObjectiveStatusUpdateInput,
  type WorkspaceObjectiveActionResult,
  type WorkspaceObjectiveCollection,
  type WorkspaceObjectiveCreateInput,
  type WorkspaceObjectiveRecord,
  type WorkspaceObjectiveStatusUpdateInput,
} from "@/features/workspace-objectives"

import {
  isMissingTableError,
  mapObjectiveGroupRow,
  mapObjectiveRowWithoutRelations,
  mapObjectiveRows,
  resolveWorkspaceObjectiveActorContext,
  WORKSPACE_OBJECTIVE_GROUP_ROW_SELECT,
  WORKSPACE_OBJECTIVE_ROW_SELECT,
  type ObjectiveAssigneeRow,
  type ObjectiveGroupRow,
  type ObjectiveLinkRow,
  type ObjectiveRow,
} from "./workspace-objectives-actions-helpers"

export async function loadWorkspaceObjectivesAction(): Promise<
  WorkspaceObjectiveActionResult<WorkspaceObjectiveCollection>
> {
  const actor = await resolveWorkspaceObjectiveActorContext()
  if (!actor.ok) return asWorkspaceObjectiveActionError(actor.error)

  const { supabase, activeOrg, userId } = actor

  const [groupsResult, objectivesResult, assigneesResult, linksResult] = await Promise.all([
    supabase
      .from("organization_workspace_objective_groups")
      .select(WORKSPACE_OBJECTIVE_GROUP_ROW_SELECT)
      .eq("org_id", activeOrg.orgId)
      .order("created_at", { ascending: true })
      .returns<ObjectiveGroupRow[]>(),
    supabase
      .from("organization_workspace_objectives")
      .select(WORKSPACE_OBJECTIVE_ROW_SELECT)
      .eq("org_id", activeOrg.orgId)
      .order("updated_at", { ascending: false })
      .returns<ObjectiveRow[]>(),
    supabase
      .from("organization_workspace_objective_assignees")
      .select("objective_id, user_id, role, created_by, created_at")
      .eq("org_id", activeOrg.orgId)
      .returns<ObjectiveAssigneeRow[]>(),
    supabase
      .from("organization_workspace_objective_links")
      .select("id, objective_id, card_id, entity_type, entity_id, link_kind, created_by, created_at")
      .eq("org_id", activeOrg.orgId)
      .returns<ObjectiveLinkRow[]>(),
  ])

  const reads = [
    [groupsResult.error, "organization_workspace_objective_groups"],
    [objectivesResult.error, "organization_workspace_objectives"],
    [assigneesResult.error, "organization_workspace_objective_assignees"],
    [linksResult.error, "organization_workspace_objective_links"],
  ] as const
  // A missing table never overrides another read's access or transport failure.
  if (reads.some(([error, table]) => error && !isMissingTableError(error, table))) {
    return asWorkspaceObjectiveActionError("Unable to load objectives.")
  }
  const missingObjectivesTables = reads.some(([error, table]) => isMissingTableError(error, table))

  if (missingObjectivesTables) {
    const boardResult = await supabase
      .from("organization_workspace_boards")
      .select("state")
      .eq("org_id", activeOrg.orgId)
      .maybeSingle<{ state: unknown }>()

    if (boardResult.error) {
      return asWorkspaceObjectiveActionError("Unable to load objectives.")
    }

    return {
      ok: true,
      data: mapLegacyTrackerStateToObjectiveCollection({
        orgId: activeOrg.orgId,
        actorId: userId,
        state: boardResult.data?.state,
      }),
    }
  }

  const objectiveRows = objectivesResult.data ?? []
  if (objectiveRows.length === 0) {
    const boardResult = await supabase
      .from("organization_workspace_boards")
      .select("state")
      .eq("org_id", activeOrg.orgId)
      .maybeSingle<{ state: unknown }>()

    if (boardResult.error) return asWorkspaceObjectiveActionError("Unable to load objectives.")
    const fallback = mapLegacyTrackerStateToObjectiveCollection({
      orgId: activeOrg.orgId,
      actorId: userId,
      state: boardResult.data?.state,
    })
    if (fallback.loadedFrom === "legacy_tracker") {
      return { ok: true, data: fallback }
    }
  }

  return {
    ok: true,
    data: {
      groups: (groupsResult.data ?? []).map(mapObjectiveGroupRow),
      objectives: mapObjectiveRows({
        objectiveRows,
        assigneeRows: assigneesResult.data ?? [],
        linkRows: linksResult.data ?? [],
      }),
      loadedFrom: "normalized",
    },
  }
}

export async function createWorkspaceObjectiveGroupAction({
  title,
}: {
  title: string
}): Promise<WorkspaceObjectiveActionResult<WorkspaceObjectiveCollection["groups"][number]>> {
  const actor = await resolveWorkspaceObjectiveActorContext()
  if (!actor.ok) return asWorkspaceObjectiveActionError(actor.error)

  if (!canEditOrganization(actor.activeOrg.role)) {
    return asWorkspaceObjectiveActionError("Only owner, admin, or staff can create categories.")
  }

  const normalizedTitle = title.trim()
  if (!normalizedTitle) {
    return asWorkspaceObjectiveActionError("Category title is required.")
  }

  const { data, error } = await actor.supabase.rpc("write_workspace_objective_group", {
    p_org_id: actor.activeOrg.orgId,
    p_group_id: null,
    p_expected_updated_at: null,
    p_title: normalizedTitle,
    p_archived: null,
  }).returns<ObjectiveGroupRow>()

  if (error || !data) {
    return asWorkspaceObjectiveActionError("Unable to confirm category creation. Reload before trying again.")
  }

  return {
    ok: true,
    data: mapObjectiveGroupRow(data),
  }
}

export async function setWorkspaceObjectiveGroupArchivedAction({
  groupId,
  archived,
  expectedUpdatedAt,
}: {
  groupId: string
  archived: boolean
  expectedUpdatedAt: string
}): Promise<WorkspaceObjectiveActionResult<{ groupId: string; archived: boolean }>> {
  const actor = await resolveWorkspaceObjectiveActorContext()
  if (!actor.ok) return asWorkspaceObjectiveActionError(actor.error)

  if (!canEditOrganization(actor.activeOrg.role)) {
    return asWorkspaceObjectiveActionError("Only owner, admin, or staff can archive categories.")
  }

  const normalizedGroupId = groupId.trim()
  if (!normalizedGroupId) return asWorkspaceObjectiveActionError("Category ID is required.")

  if (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt))) {
    return asWorkspaceObjectiveActionError("Category changed. Reload and try again.")
  }
  const { data, error } = await actor.supabase.rpc("write_workspace_objective_group", {
    p_org_id: actor.activeOrg.orgId,
    p_group_id: normalizedGroupId,
    p_expected_updated_at: expectedUpdatedAt,
    p_title: null,
    p_archived: archived,
  }).returns<ObjectiveGroupRow>()

  if (error || !data || data.id !== normalizedGroupId) {
    return asWorkspaceObjectiveActionError(error?.code === "40001"
      ? "Category changed. Reload and try again."
      : "Unable to confirm category update. Reload and try again.")
  }

  return {
    ok: true,
    data: {
      groupId: normalizedGroupId,
      archived: data.archived_at !== null,
    },
  }
}

export async function createWorkspaceObjectiveAction(
  input: WorkspaceObjectiveCreateInput,
): Promise<WorkspaceObjectiveActionResult<WorkspaceObjectiveRecord>> {
  const actor = await resolveWorkspaceObjectiveActorContext()
  if (!actor.ok) return asWorkspaceObjectiveActionError(actor.error)

  if (!canEditOrganization(actor.activeOrg.role)) {
    return asWorkspaceObjectiveActionError("Only owner, admin, or staff can create objectives.")
  }

  const normalized = normalizeWorkspaceObjectiveCreateInput(input)
  if (!normalized.title) {
    return asWorkspaceObjectiveActionError("Objective title is required.")
  }

  const { data, error } = await actor.supabase.rpc("write_workspace_objective", {
    p_mode: "create", p_org_id: actor.activeOrg.orgId, p_objective_id: null,
    p_expected_updated_at: null, p_title: normalized.title,
    p_description: normalized.description ?? null, p_priority: normalized.priority ?? "normal",
    p_due_at: normalized.dueAt ?? null, p_group_id: normalized.groupId ?? null,
    p_status: null, p_user_ids: input.userIds ?? null,
  }).returns<ObjectiveRow>()

  if (error || !data || data.org_id !== actor.activeOrg.orgId) {
    return asWorkspaceObjectiveActionError("Unable to confirm objective creation. Reload before trying again.")
  }

  return {
    ok: true,
    data: mapObjectiveRowWithoutRelations(data),
  }
}

export async function setWorkspaceObjectiveAssigneesAction({
  objectiveId,
  userIds,
}: {
  objectiveId: string
  userIds: string[]
}): Promise<WorkspaceObjectiveActionResult<{ objectiveId: string; userIds: string[] }>> {
  const actor = await resolveWorkspaceObjectiveActorContext()
  if (!actor.ok) return asWorkspaceObjectiveActionError(actor.error)

  if (!canEditOrganization(actor.activeOrg.role)) {
    return asWorkspaceObjectiveActionError("Only owner, admin, or staff can assign objectives.")
  }

  const normalizedObjectiveId = objectiveId.trim()
  if (!normalizedObjectiveId) {
    return asWorkspaceObjectiveActionError("Objective ID is required.")
  }

  const uniqueUserIds = Array.from(
    new Set(
      userIds
        .map((userId) => userId.trim())
        .filter((userId) => userId.length > 0),
    ),
  )

  const objectiveResult = await actor.supabase
    .from("organization_workspace_objectives")
    .select("updated_at")
    .eq("org_id", actor.activeOrg.orgId)
    .eq("id", normalizedObjectiveId)
    .maybeSingle<{ updated_at: string }>()

  if (objectiveResult.error || !objectiveResult.data) {
    return asWorkspaceObjectiveActionError("Unable to find objective.")
  }

  const { data: nextUserIds, error } = await actor.supabase.rpc("replace_workspace_objective_assignees", {
    p_org_id: actor.activeOrg.orgId,
    p_objective_id: normalizedObjectiveId,
    p_expected_updated_at: objectiveResult.data.updated_at,
    p_user_ids: uniqueUserIds,
  })
  if (error || !nextUserIds) {
    return asWorkspaceObjectiveActionError(error?.code === "40001"
      ? "Assignments changed. Reload and try again."
      : "Unable to confirm assignments. Reload and try again.")
  }

  return {
    ok: true,
    data: {
      objectiveId: normalizedObjectiveId,
      userIds: nextUserIds,
    },
  }
}

export async function setWorkspaceObjectiveDetailsAction({
  objectiveId,
  expectedUpdatedAt,
  userIds,
  title,
  description,
  priority,
  dueAt,
  groupId,
}: {
  objectiveId: string
  expectedUpdatedAt: string
  userIds?: string[]
  title: string
  description: string | null
  priority: "low" | "normal" | "high" | "critical"
  dueAt: string | null
  groupId: string | null
}): Promise<WorkspaceObjectiveActionResult<WorkspaceObjectiveRecord>> {
  const actor = await resolveWorkspaceObjectiveActorContext()
  if (!actor.ok) return asWorkspaceObjectiveActionError(actor.error)

  if (!canEditOrganization(actor.activeOrg.role)) {
    return asWorkspaceObjectiveActionError("Only owner, admin, or staff can update objectives.")
  }

  const normalizedObjectiveId = objectiveId.trim()
  const normalizedTitle = title.trim()
  if (!normalizedObjectiveId) {
    return asWorkspaceObjectiveActionError("Objective ID is required.")
  }
  if (!normalizedTitle) {
    return asWorkspaceObjectiveActionError("Objective title is required.")
  }

  if (!expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
    return asWorkspaceObjectiveActionError("Objective changed. Reload and try again.")
  }

  const normalizedDescription = description?.trim() ? description.trim() : null
  const normalizedDueAt = dueAt?.trim() ? dueAt : null
  const normalizedGroupId = groupId?.trim() ? groupId.trim() : null
  const normalizedPriority =
    priority === "low" || priority === "high" || priority === "critical" ? priority : "normal"

  const { data, error } = await actor.supabase.rpc("write_workspace_objective", {
    p_mode: "details", p_org_id: actor.activeOrg.orgId, p_objective_id: normalizedObjectiveId,
    p_expected_updated_at: expectedUpdatedAt, p_title: normalizedTitle,
    p_description: normalizedDescription, p_priority: normalizedPriority,
    p_due_at: normalizedDueAt, p_group_id: normalizedGroupId,
    p_status: null, p_user_ids: userIds ?? null,
  }).returns<ObjectiveRow>()

  if (error || !data || data.id !== normalizedObjectiveId || data.org_id !== actor.activeOrg.orgId) {
    return asWorkspaceObjectiveActionError(error?.code === "40001"
      ? "Objective changed. Reload and try again."
      : "Unable to confirm objective update. Reload and try again.")
  }

  return {
    ok: true,
    data: mapObjectiveRowWithoutRelations(data),
  }
}

export async function setWorkspaceObjectiveStatusAction(
  input: WorkspaceObjectiveStatusUpdateInput,
): Promise<WorkspaceObjectiveActionResult<WorkspaceObjectiveRecord>> {
  const actor = await resolveWorkspaceObjectiveActorContext()
  if (!actor.ok) return asWorkspaceObjectiveActionError(actor.error)

  if (!canEditOrganization(actor.activeOrg.role)) {
    return asWorkspaceObjectiveActionError("Only owner, admin, or staff can update objective status.")
  }

  const normalized = normalizeWorkspaceObjectiveStatusUpdateInput(input)
  if (!normalized.objectiveId) {
    return asWorkspaceObjectiveActionError("Objective ID is required.")
  }

  if (!normalized.expectedUpdatedAt || !Number.isFinite(Date.parse(normalized.expectedUpdatedAt))) {
    return asWorkspaceObjectiveActionError("Objective changed. Reload and try again.")
  }
  const { data, error } = await actor.supabase.rpc("write_workspace_objective", {
    p_mode: "status", p_org_id: actor.activeOrg.orgId, p_objective_id: normalized.objectiveId,
    p_expected_updated_at: normalized.expectedUpdatedAt, p_title: null,
    p_description: null, p_priority: null, p_due_at: null, p_group_id: null,
    p_status: normalized.status, p_user_ids: null,
  }).returns<ObjectiveRow>()

  if (error || !data || data.id !== normalized.objectiveId || data.org_id !== actor.activeOrg.orgId) {
    return asWorkspaceObjectiveActionError(error?.code === "40001"
      ? "Objective changed. Reload and try again."
      : "Unable to confirm objective update. Reload and try again.")
  }

  return {
    ok: true,
    data: mapObjectiveRowWithoutRelations(data),
  }
}
