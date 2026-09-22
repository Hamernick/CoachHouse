export type OrganizationCoachOption = {
  assignable?: boolean
  id: string
  name: string
  email: string | null
  avatarUrl: string | null
}

export type OrganizationCoachAssignment = {
  organizationId: string
  coach: OrganizationCoachOption
  assignedBy: string | null
  updatedAt: string
}

export type OrganizationCoachAssignmentData = {
  available: boolean
  assignmentsByOrganizationId: Map<string, OrganizationCoachAssignment[]>
  coachOptions: OrganizationCoachOption[]
  scopeStatus: OrganizationCoachScopeStatus
}

export type UpdateOrganizationCoachAssignmentInput = {
  organizationId: string
  coachUserIds: string[]
}

export type UpdateOrganizationCoachAssignmentResult =
  | { ok: true; organizationId: string; coachUserIds: string[] }
  | { error: string }

export type OrganizationCoachAssignmentAction = (
  input: UpdateOrganizationCoachAssignmentInput
) => Promise<UpdateOrganizationCoachAssignmentResult>

export type AssignAllOrganizationCoachesResult =
  | {
      ok: true
      organizationCount: number
      coachCount: number
      assignmentCount: number
      addedCount: number
    }
  | { error: string }

export type AssignAllOrganizationCoachesAction =
  () => Promise<AssignAllOrganizationCoachesResult>

export type SetOrganizationCoachScopeResult =
  | {
      ok: true
      assignedOnlyEnabled: boolean
      organizationCount: number
      assignmentCount: number
      unassignedCount: number
    }
  | { error: string }

export type SetOrganizationCoachScopeAction = (
  enabled: boolean
) => Promise<SetOrganizationCoachScopeResult>

export type OrganizationCoachFilterValue = "all" | "unassigned" | string

export type OrganizationCoachAssignmentCoverage = {
  totalOrganizations: number
  coveredOrganizations: number
  unassignedOrganizations: number
  assignmentCount: number
  countByCoachId: Record<string, number>
}
import type {
  OrganizationCoachActorScope,
  OrganizationCoachScopeStatus,
} from "@/lib/organization-coach-scope"

export type {
  OrganizationCoachActorScope,
  OrganizationCoachScopeStatus,
} from "@/lib/organization-coach-scope"
