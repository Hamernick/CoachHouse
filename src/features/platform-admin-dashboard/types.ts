export type PlatformAdminDashboardLabSection =
  | "inbox"
  | "my-tasks"
  | "projects"
  | "clients"
  | "performance"

export type PlatformAdminDashboardLabViewType = "list" | "board" | "timeline"

export type PlatformAdminDashboardLabStatus =
  | "backlog"
  | "planned"
  | "active"
  | "on-hold"
  | "cancelled"
  | "completed"

export type PlatformAdminDashboardLabFiscalSponsorshipStatus =
  | "not_eligible"
  | "eligible"
  | "in_progress"
  | "active"

export type PlatformAdminDashboardLabPriority =
  | "urgent"
  | "high"
  | "medium"
  | "low"

export type PlatformAdminDashboardLabTaskStatus =
  | "waiting"
  | "todo"
  | "in-progress"
  | "done"

export type PlatformAdminDashboardLabTask = {
  id: string
  name: string
  type: "bug" | "improvement" | "task"
  assignee: string
  status: PlatformAdminDashboardLabTaskStatus
  startDate: Date
  endDate: Date
}

export type PlatformAdminDashboardLabOrganizationCoachAssignment = {
  organizationId: string
  coach: {
    id: string
    name: string
    email: string | null
    avatarUrl: string | null
  }
  assignedBy: string | null
  updatedAt: string
}

export type PlatformAdminDashboardLabProject = {
  createdAt?: string
  canEditSchedule?: boolean
  fiscalSponsorshipEnabled?: boolean
  recurrence?: "none" | "monthly"
  id: string
  organizationId?: string
  organizationUnassigned?: boolean
  projectKind?: "standard" | "organization_admin"
  workstreamCategoryId?: string
  fiscalSponsorshipStatus?: PlatformAdminDashboardLabFiscalSponsorshipStatus
  name: string
  description?: string
  taskCount: number
  progress: number
  startDate: Date | null
  endDate: Date | null
  status: PlatformAdminDashboardLabStatus
  priority: PlatformAdminDashboardLabPriority
  tags: string[]
  members: string[]
  primaryPersonName?: string
  primaryPersonAvatarUrl?: string | null
  organizationImageUrl?: string | null
  organizationCoachAssignments?: PlatformAdminDashboardLabOrganizationCoachAssignment[]
  client?: string
  typeLabel?: string
  durationLabel?: string
  taskSummaryLabel?: string
  tasks: PlatformAdminDashboardLabTask[]
}

export type PlatformAdminDashboardLabNavItem = {
  id: PlatformAdminDashboardLabSection
  label: string
  badge?: number
}

export type PlatformAdminDashboardLabActiveProjectSummary = {
  id: string
  name: string
  color: string
  progress: number
}

export type PlatformAdminDashboardLabSessionUser = {
  name: string | null
  email: string | null
  avatar: string | null
}

export type PlatformAdminDashboardLabState = {
  user: PlatformAdminDashboardLabSessionUser
  navItems: PlatformAdminDashboardLabNavItem[]
  activeProjects: PlatformAdminDashboardLabActiveProjectSummary[]
  projects: PlatformAdminDashboardLabProject[]
  sourceCommit: string
  sourceRepoUrl: string
}

export type PlatformAdminDashboardLabFilters = {
  query: string
  status: PlatformAdminDashboardLabStatus | null
  priority: PlatformAdminDashboardLabPriority | null
}
