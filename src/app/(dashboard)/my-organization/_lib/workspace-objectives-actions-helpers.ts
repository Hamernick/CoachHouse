export { isMissingTableError } from "@/features/workspace-objectives/server/read-errors"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import type { WorkspaceObjectiveCollection, WorkspaceObjectiveRecord } from "@/features/workspace-objectives"

export const WORKSPACE_OBJECTIVE_GROUP_ROW_SELECT =
  "id, org_id, title, kind, source_type, archived_at, created_by, created_at, updated_at"

export const WORKSPACE_OBJECTIVE_ROW_SELECT =
  "id, org_id, group_id, title, description, status, priority, kind, source_type, source_key, due_at, completed_at, position_rank, created_by, updated_by, created_at, updated_at"

export type ObjectiveGroupRow = {
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

export type ObjectiveRow = {
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

export type ObjectiveAssigneeRow = {
  objective_id: string
  user_id: string
  role: string
  created_by: string
  created_at: string
}

export type ObjectiveLinkRow = {
  id: string
  objective_id: string
  card_id: string
  entity_type: string | null
  entity_id: string | null
  link_kind: string
  created_by: string
  created_at: string
}

export async function resolveWorkspaceObjectiveActorContext() {
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

export function mapObjectiveGroupRow(
  row: ObjectiveGroupRow,
): WorkspaceObjectiveCollection["groups"][number] {
  return {
    id: row.id,
    orgId: row.org_id,
    title: row.title,
    kind: row.kind as WorkspaceObjectiveCollection["groups"][number]["kind"],
    sourceType: row.source_type as WorkspaceObjectiveCollection["groups"][number]["sourceType"],
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapObjectiveRowWithoutRelations(row: ObjectiveRow): WorkspaceObjectiveRecord {
  return {
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
    assignees: [],
    links: [],
  }
}

export function mapObjectiveRows({
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
    ...mapObjectiveRowWithoutRelations(row),
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
