export const WORKSPACE_OBJECTIVE_STATUS = ["todo", "in_progress", "blocked", "done", "archived"] as const
export type WorkspaceObjectiveStatus = (typeof WORKSPACE_OBJECTIVE_STATUS)[number]

export const WORKSPACE_OBJECTIVE_PRIORITY = ["low", "normal", "high", "critical"] as const
export type WorkspaceObjectivePriority = (typeof WORKSPACE_OBJECTIVE_PRIORITY)[number]

export const WORKSPACE_OBJECTIVE_KIND = ["system", "custom"] as const
export type WorkspaceObjectiveKind = (typeof WORKSPACE_OBJECTIVE_KIND)[number]

export const WORKSPACE_OBJECTIVE_SOURCE_TYPE = [
  "accelerator_module",
  "accelerator_step",
  "roadmap_section",
  "calendar_event",
  "custom",
] as const
export type WorkspaceObjectiveSourceType = (typeof WORKSPACE_OBJECTIVE_SOURCE_TYPE)[number]

export const WORKSPACE_OBJECTIVE_CARD_ID = [
  "organization-overview",
  "accelerator",
  "brand-kit",
  "economic-engine",
  "calendar",
  "communications",
  "deck",
  "vault",
  "atlas",
] as const
export type WorkspaceObjectiveCardId = (typeof WORKSPACE_OBJECTIVE_CARD_ID)[number]

export type WorkspaceObjectiveGroup = {
  id: string
  orgId: string
  title: string
  kind: WorkspaceObjectiveKind
  sourceType: "accelerator" | "roadmap" | "calendar" | "communications" | "economic_engine" | "none" | null
  archivedAt: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type WorkspaceObjectiveAssignee = {
  objectiveId: string
  userId: string
  role: "owner" | "assignee" | "watcher"
  createdBy: string
  createdAt: string
}

export type WorkspaceObjectiveLink = {
  id: string
  objectiveId: string
  cardId: WorkspaceObjectiveCardId
  entityType: "roadmap_section" | "calendar_event" | "module" | "assignment" | "none" | null
  entityId: string | null
  linkKind: "primary" | "secondary" | "dependency"
  createdBy: string
  createdAt: string
}

export type WorkspaceObjective = {
  id: string
  orgId: string
  groupId: string | null
  title: string
  description: string | null
  status: WorkspaceObjectiveStatus
  priority: WorkspaceObjectivePriority
  kind: WorkspaceObjectiveKind
  sourceType: WorkspaceObjectiveSourceType
  sourceKey: string | null
  dueAt: string | null
  completedAt: string | null
  positionRank: number
  createdBy: string
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export type WorkspaceObjectiveRecord = WorkspaceObjective & {
  assignees: WorkspaceObjectiveAssignee[]
  links: WorkspaceObjectiveLink[]
}

export type WorkspaceObjectiveCollection = {
  groups: WorkspaceObjectiveGroup[]
  objectives: WorkspaceObjectiveRecord[]
  loadedFrom: "normalized" | "legacy_tracker" | "empty"
}

export type WorkspaceObjectiveCreateInput = {
  userIds?: string[]
  title: string
  description?: string | null
  groupId?: string | null
  priority?: WorkspaceObjectivePriority
  dueAt?: string | null
}

export type WorkspaceObjectiveStatusUpdateInput = {
  expectedUpdatedAt: string
  objectiveId: string
  status: WorkspaceObjectiveStatus
}

export type WorkspaceObjectiveActionResult<TData> = { ok: true; data: TData } | { ok: false; error: string }
