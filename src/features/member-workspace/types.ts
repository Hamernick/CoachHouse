import type { OrgPerson } from "@/actions/people"
import type { OrganizationMemberRole } from "@/lib/organization/active-org"
import type {
  PlatformAdminDashboardLabPriority,
  PlatformAdminDashboardLabStatus,
} from "@/features/platform-admin-dashboard"

export type MemberWorkspaceSection = "projects" | "my-tasks" | "people"

export type MemberWorkspaceAccessibleOrganization = {
  orgId: string
  role: OrganizationMemberRole
  name: string
  publicSlug: string | null
  imageUrl: string | null
}

export type MemberWorkspaceProjectOrganizationOption = {
  orgId: string
  name: string
}

export type MemberWorkspacePersonOption = {
  id: string
  name: string
  avatarUrl: string | null
  email?: string | null
  roleLabel?: string | null
  groupKey?: "platform-admins" | "organization-team"
  groupLabel?: string | null
}

export type MemberWorkspaceHeaderState = {
  activeOrganization: MemberWorkspaceAccessibleOrganization
  accessibleOrganizations: MemberWorkspaceAccessibleOrganization[]
}

export type MemberWorkspaceSetActiveOrganizationResult =
  | { ok: true; orgId: string }
  | { error: string }

export type MemberWorkspaceStorageMode =
  | "empty"
  | "starter"
  | "mixed"
  | "custom"

export type MemberWorkspaceWorkstreamCategory = {
  id: string
  name: string
  color: string
  position: number
  defaultKey: string | null
}

export type MemberWorkspaceTaskStatus = "todo" | "in-progress" | "done"

export type MemberWorkspaceTaskType = "bug" | "improvement" | "task"

export type MemberWorkspaceTaskAssignee = {
  id: string
  name: string
  avatarUrl: string | null
}

export type MemberWorkspaceTaskItem = {
  organizationName?: string
  id: string
  projectId: string
  projectName: string
  projectClient: string | null
  projectStatus: PlatformAdminDashboardLabStatus
  projectPriority: PlatformAdminDashboardLabPriority
  projectTags: string[]
  projectMembers: string[]
  projectTypeLabel?: string | null
  projectDurationLabel?: string | null
  projectStartDate: string
  projectEndDate: string
  title: string
  description?: string
  taskType: MemberWorkspaceTaskType
  status: MemberWorkspaceTaskStatus
  startDate: string
  endDate: string
  priority?: "no-priority" | "low" | "medium" | "high" | "urgent"
  tagLabel?: string | null
  workstreamName?: string | null
  assignee?: MemberWorkspaceTaskAssignee | null
  canUpdate: boolean
}

export type MemberWorkspaceTaskGroup = {
  projectId: string
  projectName: string
  projectClient: string | null
  projectStatus: PlatformAdminDashboardLabStatus
  projectPriority: PlatformAdminDashboardLabPriority
  projectTags: string[]
  projectMembers: string[]
  projectTypeLabel?: string | null
  projectDurationLabel?: string | null
  projectStartDate: string
  projectEndDate: string
  tasks: MemberWorkspaceTaskItem[]
}

export type MemberWorkspaceCreateProjectFormInput = {
  orgId?: string
  name: string
  description?: string
  overviewDocumentHtml?: string
  status: PlatformAdminDashboardLabStatus
  priority: PlatformAdminDashboardLabPriority
  startDate: string
  endDate: string
  clientName?: string
  typeLabel?: string
  durationLabel?: string
  tags?: string
  optionSettings?: import("./lib/project-option-settings").ProjectOptionSettings
  memberLabels?: string
}

export type MemberWorkspaceCreateTaskInput = {
  projectId: string
  title: string
  description?: string
  status: MemberWorkspaceTaskStatus
  startDate: string
  endDate: string
  priority?: "no-priority" | "low" | "medium" | "high" | "urgent"
  tagLabel?: string
  workstreamName?: string
  assigneeUserId?: string
}

export type MemberWorkspaceCreateProjectNoteInput = {
  projectId: string
  title: string
  content?: string
  noteType?: "general" | "meeting" | "audio"
}

export type MemberWorkspaceUpdateProjectNoteInput = {
  projectId: string
  noteId: string
  title: string
  content?: string
  noteType?: "general" | "meeting" | "audio"
}

export type MemberWorkspaceCreateProjectQuickLinkInput = {
  projectId: string
  name: string
  url: string
}

export type MemberWorkspaceUpdateProjectQuickLinkInput = {
  projectId: string
  linkId: string
  name: string
  url: string
}

export type MemberWorkspaceDisplayPerson = OrgPerson & {
  displayImage: string | null
}

export type MemberWorkspaceAdminOrganizationMember = {
  userId: string
  name: string
  email: string | null
  avatarUrl: string | null
  headline: string | null
  organizationRole: string
  platformRole: string | null
  isOwner: boolean
  profileCompletenessPercent?: number
  profileCompletedCount?: number
  profileTotalCount?: number
  profileMissingFields?: string[]
}

export type MemberWorkspaceAdminOrganizationProgram = {
  id: string
  title: string
  statusLabel: string
  startAt: string | null
  endAt: string | null
  isPublic: boolean
}

export type MemberWorkspaceAdminOrganizationSetupItem = {
  id: string
  label: string
  complete: boolean
}

export type MemberWorkspaceAdminOrganizationSummary = {
  orgId: string
  canonicalProjectId: string | null
  name: string
  ownerName: string
  ownerAvatarUrl: string | null
  publicSlug: string | null
  organizationStatus: "pending" | "approved" | "n/a"
  isPublic: boolean
  createdAt: string
  updatedAt: string
  acceleratorProgress: number
  setupProgress: number
  setupCompletedCount: number
  setupTotalCount: number
  missingSetupCount: number
  memberCount: number
  tags: string[]
  members: MemberWorkspaceAdminOrganizationMember[]
  setupItems: MemberWorkspaceAdminOrganizationSetupItem[]
  programs?: MemberWorkspaceAdminOrganizationProgram[]
  profile: Record<string, unknown>
}

export type MemberWorkspacePeoplePageData =
  | {
      mode: "organization"
      people: MemberWorkspaceDisplayPerson[]
      canEdit: boolean
    }
  | {
      mode: "platform-admin"
      organizations: MemberWorkspaceAdminOrganizationSummary[]
      summary: {
        organizationCount: number
        memberCount: number
      }
    }
