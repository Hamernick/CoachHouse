"use server"

import { canEditOrganization, resolveActiveOrganization } from "@/lib/organization/active-org"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isMissingTableError } from "./read-errors"

import {
  asWorkspaceObjectiveActionError,
  mapLegacyTrackerStateToObjectiveCollection,
  normalizeWorkspaceObjectiveCreateInput,
  normalizeWorkspaceObjectiveStatusUpdateInput,
} from "../lib"
import type {
  WorkspaceObjectiveActionResult,
  WorkspaceObjectiveCollection,
  WorkspaceObjectiveCreateInput,
  WorkspaceObjectiveRecord,
  WorkspaceObjectiveStatusUpdateInput,
} from "../types"

type ObjectiveGroupRow = {
  id: string
  org_id: string
  title: string
  kind: string
  source_type: string | null
  archived_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

type ObjectiveRow = {
  id: string
  org_id: string
  group_id: string | null
  title: string
  description: string | null
  status: string
  priority: string
  kind: string
  source_type: string
  source_key: string | null
  due_at: string | null
  completed_at: string | null
  position_rank: number
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

type ObjectiveAssigneeRow = {
  objective_id: string
  user_id: string
  role: string
  created_by: string
  created_at: string
}

type ObjectiveLinkRow = {
  id: string
  objective_id: string
  card_id: string
  entity_type: string | null
  entity_id: string | null
  link_kind: string
  created_by: string
  created_at: string
}

async function resolveActorContext() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError && !isSupabaseAuthSessionMissingError(userError)) {
    return { ok: false as const, error: "Unable to load user." }
  }
  if (!user) {
    return { ok: false as const, error: "You must be signed in." }
  }

  const activeOrg = await resolveActiveOrganization(supabase, user.id)
  return {
    ok: true as const,
    supabase,
    userId: user.id,
    activeOrg,
  }
}

function mapObjectiveRows({
  objectiveRows,
  assigneeRows,
  linkRows,
}: {
  objectiveRows: ObjectiveRow[]
  assigneeRows: ObjectiveAssigneeRow[]
  linkRows: ObjectiveLinkRow[]
}) {
  const assigneesByObjective = new Map<string, ObjectiveAssigneeRow[]>()
  for (const row of assigneeRows) {
    const existing = assigneesByObjective.get(row.objective_id)
    if (existing) existing.push(row)
    else assigneesByObjective.set(row.objective_id, [row])
  }

  const linksByObjective = new Map<string, ObjectiveLinkRow[]>()
  for (const row of linkRows) {
    const existing = linksByObjective.get(row.objective_id)
    if (existing) existing.push(row)
    else linksByObjective.set(row.objective_id, [row])
  }

  return objectiveRows.map<WorkspaceObjectiveRecord>((row) => ({
    id: row.id,
    orgId: row.org_id,
    groupId: row.group_id,
    title: row.title,
    description: row.description,
    status: row.status as WorkspaceObjectiveRecord["status"],
    priority: row.priority as WorkspaceObjectiveRecord["priority"],
    kind: row.kind as WorkspaceObjectiveRecord["kind"],
    sourceType: row.source_type as WorkspaceObjectiveRecord["sourceType"],
    sourceKey: row.source_key,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    positionRank: row.position_rank,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignees: (assigneesByObjective.get(row.id) ?? []).map((assignee) => ({
      objectiveId: assignee.objective_id,
      userId: assignee.user_id,
      role: assignee.role as WorkspaceObjectiveRecord["assignees"][number]["role"],
      createdBy: assignee.created_by,
      createdAt: assignee.created_at,
    })),
    links: (linksByObjective.get(row.id) ?? []).map((link) => ({
      id: link.id,
      objectiveId: link.objective_id,
      cardId: link.card_id as WorkspaceObjectiveRecord["links"][number]["cardId"],
      entityType: link.entity_type as WorkspaceObjectiveRecord["links"][number]["entityType"],
      entityId: link.entity_id,
      linkKind: link.link_kind as WorkspaceObjectiveRecord["links"][number]["linkKind"],
      createdBy: link.created_by,
      createdAt: link.created_at,
    })),
  }))
}

export async function loadWorkspaceObjectivesAction(): Promise<
  WorkspaceObjectiveActionResult<WorkspaceObjectiveCollection>
> {
  const actor = await resolveActorContext()
  if (!actor.ok) return asWorkspaceObjectiveActionError(actor.error)

  const { supabase, activeOrg, userId } = actor

  const [groupsResult, objectivesResult, assigneesResult, linksResult] = await Promise.all([
    supabase
      .from("organization_workspace_objective_groups")
      .select("id, org_id, title, kind, source_type, archived_at, created_by, created_at, updated_at")
      .eq("org_id", activeOrg.orgId)
      .order("created_at", { ascending: true })
      .returns<ObjectiveGroupRow[]>(),
    supabase
      .from("organization_workspace_objectives")
      .select(
        "id, org_id, group_id, title, description, status, priority, kind, source_type, source_key, due_at, completed_at, position_rank, created_by, updated_by, created_at, updated_at",
      )
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
      groups: (groupsResult.data ?? []).map((group) => ({
        id: group.id,
        orgId: group.org_id,
        title: group.title,
        kind: group.kind as WorkspaceObjectiveCollection["groups"][number]["kind"],
        sourceType: group.source_type as WorkspaceObjectiveCollection["groups"][number]["sourceType"],
        archivedAt: group.archived_at,
        createdBy: group.created_by,
        createdAt: group.created_at,
        updatedAt: group.updated_at,
      })),
      objectives: mapObjectiveRows({
        objectiveRows,
        assigneeRows: assigneesResult.data ?? [],
        linkRows: linksResult.data ?? [],
      }),
      loadedFrom: "normalized",
    },
  }
}

export async function createWorkspaceObjectiveAction(
  input: WorkspaceObjectiveCreateInput,
): Promise<WorkspaceObjectiveActionResult<WorkspaceObjectiveRecord>> {
  const actor = await resolveActorContext()
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
    data: {
      id: data.id,
      orgId: data.org_id,
      groupId: data.group_id,
      title: data.title,
      description: data.description,
      status: data.status as WorkspaceObjectiveRecord["status"],
      priority: data.priority as WorkspaceObjectiveRecord["priority"],
      kind: data.kind as WorkspaceObjectiveRecord["kind"],
      sourceType: data.source_type as WorkspaceObjectiveRecord["sourceType"],
      sourceKey: data.source_key,
      dueAt: data.due_at,
      completedAt: data.completed_at,
      positionRank: data.position_rank,
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      assignees: [],
      links: [],
    },
  }
}

export async function createWorkspaceObjectiveGroupAction({
  title,
}: {
  title: string
}): Promise<WorkspaceObjectiveActionResult<WorkspaceObjectiveCollection["groups"][number]>> {
  const actor = await resolveActorContext()
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
    data: {
      id: data.id,
      orgId: data.org_id,
      title: data.title,
      kind: data.kind as WorkspaceObjectiveCollection["groups"][number]["kind"],
      sourceType: data.source_type as WorkspaceObjectiveCollection["groups"][number]["sourceType"],
      archivedAt: data.archived_at,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
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
  const actor = await resolveActorContext()
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

export async function setWorkspaceObjectiveStatusAction(
  input: WorkspaceObjectiveStatusUpdateInput,
): Promise<WorkspaceObjectiveActionResult<WorkspaceObjectiveRecord>> {
  const actor = await resolveActorContext()
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
    data: {
      id: data.id,
      orgId: data.org_id,
      groupId: data.group_id,
      title: data.title,
      description: data.description,
      status: data.status as WorkspaceObjectiveRecord["status"],
      priority: data.priority as WorkspaceObjectiveRecord["priority"],
      kind: data.kind as WorkspaceObjectiveRecord["kind"],
      sourceType: data.source_type as WorkspaceObjectiveRecord["sourceType"],
      sourceKey: data.source_key,
      dueAt: data.due_at,
      completedAt: data.completed_at,
      positionRank: data.position_rank,
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      assignees: [],
      links: [],
    },
  }
}
