import type {
  WorkspaceObjectiveActionResult,
  WorkspaceObjectiveCollection,
  WorkspaceObjectiveCreateInput,
  WorkspaceObjectiveGroup,
  WorkspaceObjectivePriority,
  WorkspaceObjectiveRecord,
  WorkspaceObjectiveStatus,
  WorkspaceObjectiveStatusUpdateInput,
} from "../types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object"
}

function normalizedText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback
  return value.trim()
}

function normalizeDate(value: unknown, fallback: string | null = null) {
  if (typeof value !== "string") return fallback
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return fallback
  return new Date(parsed).toISOString()
}

function normalizeObjectiveStatus(value: unknown): WorkspaceObjectiveStatus {
  if (value === "in_progress" || value === "blocked" || value === "done" || value === "archived") return value
  return "todo"
}

function normalizeObjectivePriority(value: unknown): WorkspaceObjectivePriority {
  if (value === "low" || value === "high" || value === "critical") return value
  return "normal"
}

function normalizeTrackerTicketStatus(value: unknown): WorkspaceObjectiveStatus {
  if (value === "done") return "done"
  if (value === "in_progress") return "in_progress"
  return "todo"
}

export function normalizeWorkspaceObjectiveCreateInput(input: WorkspaceObjectiveCreateInput): WorkspaceObjectiveCreateInput {
  const title = normalizedText(input.title)
  return {
    title,
    description: normalizedText(input.description, "") || null,
    groupId: normalizedText(input.groupId, "") || null,
    priority: normalizeObjectivePriority(input.priority),
    dueAt: normalizeDate(input.dueAt, null),
  }
}

export function normalizeWorkspaceObjectiveStatusUpdateInput(
  input: WorkspaceObjectiveStatusUpdateInput,
): WorkspaceObjectiveStatusUpdateInput {
  return {
    objectiveId: normalizedText(input.objectiveId),
    expectedUpdatedAt: normalizedText(input.expectedUpdatedAt),
    status: normalizeObjectiveStatus(input.status),
  }
}

function buildDefaultLegacyGroup(orgId: string, actorId: string, nowIso: string): WorkspaceObjectiveGroup {
  return {
    id: "legacy-general",
    orgId,
    title: "General",
    kind: "custom",
    sourceType: "none",
    archivedAt: null,
    createdBy: actorId,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

function buildEmptyCollection(): WorkspaceObjectiveCollection {
  return {
    groups: [],
    objectives: [],
    loadedFrom: "empty",
  }
}

export function mapLegacyTrackerStateToObjectiveCollection({
  orgId,
  actorId,
  state,
  now = new Date(),
}: {
  orgId: string
  actorId: string
  state: unknown
  now?: Date
}): WorkspaceObjectiveCollection {
  if (!isRecord(state)) return buildEmptyCollection()

  const nowIso = now.toISOString()
  const tracker = isRecord(state.tracker) ? state.tracker : null
  if (!tracker) return buildEmptyCollection()

  const categoryValues = Array.isArray(tracker.categories) ? tracker.categories : []
  const groupByLegacyId = new Map<string, WorkspaceObjectiveGroup>()
  const groups: WorkspaceObjectiveGroup[] = []

  for (const categoryValue of categoryValues) {
    if (!isRecord(categoryValue)) continue
    const legacyId = normalizedText(categoryValue.id)
    const title = normalizedText(categoryValue.title)
    if (!legacyId || !title) continue

    const createdAt = normalizeDate(categoryValue.createdAt, nowIso) ?? nowIso
    const archived = Boolean(categoryValue.archived)
    const group: WorkspaceObjectiveGroup = {
      id: `legacy-${legacyId}`,
      orgId,
      title,
      kind: "custom",
      sourceType: "none",
      archivedAt: archived ? nowIso : null,
      createdBy: actorId,
      createdAt,
      updatedAt: createdAt,
    }

    groupByLegacyId.set(legacyId, group)
    groups.push(group)
  }

  const defaultGroup = buildDefaultLegacyGroup(orgId, actorId, nowIso)
  if (!groupByLegacyId.has("general")) {
    groups.unshift(defaultGroup)
  }

  const ticketValues = Array.isArray(tracker.tickets) ? tracker.tickets : []
  const objectives: WorkspaceObjectiveRecord[] = []

  for (const ticketValue of ticketValues) {
    if (!isRecord(ticketValue)) continue
    const legacyId = normalizedText(ticketValue.id)
    const title = normalizedText(ticketValue.title)
    if (!legacyId || !title) continue

    const legacyCategoryId = normalizedText(ticketValue.categoryId, "general")
    const group = groupByLegacyId.get(legacyCategoryId) ?? defaultGroup
    const createdAt = normalizeDate(ticketValue.createdAt, nowIso) ?? nowIso
    const updatedAt = normalizeDate(ticketValue.updatedAt, createdAt) ?? createdAt
    const status = normalizeTrackerTicketStatus(ticketValue.status)
    const archived = Boolean(ticketValue.archived)

    objectives.push({
      id: `legacy-${legacyId}`,
      orgId,
      groupId: group.id,
      title,
      description: null,
      status: archived ? "archived" : status,
      priority: "normal",
      kind: "custom",
      sourceType: "custom",
      sourceKey: null,
      dueAt: null,
      completedAt: status === "done" ? updatedAt : null,
      positionRank: 0,
      createdBy: actorId,
      updatedBy: actorId,
      createdAt,
      updatedAt,
      assignees: [],
      links: [],
    })
  }

  return {
    groups,
    objectives,
    loadedFrom: objectives.length > 0 || groups.length > 0 ? "legacy_tracker" : "empty",
  }
}

export function asWorkspaceObjectiveActionError<TData>(error: string): WorkspaceObjectiveActionResult<TData> {
  return { ok: false, error }
}
