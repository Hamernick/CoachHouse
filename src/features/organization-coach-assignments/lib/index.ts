import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
export {
  ALL_ORGANIZATION_COACH_SCOPE,
  canAccessOrganizationInCoachScope,
  filterByOrganizationCoachScope,
} from "@/lib/organization-coach-scope"
import type { OrganizationCoachOption } from "../types"
import type {
  OrganizationCoachAssignment,
  OrganizationCoachAssignmentCoverage,
  OrganizationCoachFilterValue,
} from "../types"

export const ORGANIZATION_COACH_FILTER_ALL = "all"
export const ORGANIZATION_COACH_FILTER_UNASSIGNED = "unassigned"

export function getOrganizationCoachAssignmentsSignature(
  assignments: OrganizationCoachAssignment[]
) {
  return JSON.stringify(
    assignments.map(({ assignedBy, coach, organizationId, updatedAt }) => [
      organizationId,
      assignedBy,
      updatedAt,
      coach.id,
      coach.name,
      coach.email,
      coach.avatarUrl,
    ])
  )
}

export function getOrganizationCoachInitials(coach: OrganizationCoachOption) {
  return coach.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function normalizeOrganizationCoachFilter({
  coachOptions,
  value,
}: {
  coachOptions: OrganizationCoachOption[]
  value: string | null | undefined
}): OrganizationCoachFilterValue {
  if (value === ORGANIZATION_COACH_FILTER_UNASSIGNED) {
    return ORGANIZATION_COACH_FILTER_UNASSIGNED
  }
  if (coachOptions.some((coach) => coach.id === value)) {
    return value as string
  }
  return ORGANIZATION_COACH_FILTER_ALL
}

export function applyOrganizationCoachFilterToParams(
  params: URLSearchParams,
  value: OrganizationCoachFilterValue
) {
  if (value === ORGANIZATION_COACH_FILTER_ALL) {
    params.delete("coach")
  } else {
    params.set("coach", value)
  }
  return params
}

export function filterProjectsByOrganizationCoach({
  projects,
  value,
}: {
  projects: PlatformAdminDashboardLabProject[]
  value: OrganizationCoachFilterValue
}) {
  if (value === ORGANIZATION_COACH_FILTER_ALL) return projects

  return projects.filter((project) => {
    if (!project.organizationId) return false
    const assignments = project.organizationCoachAssignments ?? []
    return value === ORGANIZATION_COACH_FILTER_UNASSIGNED
      ? assignments.length === 0
      : assignments.some((assignment) => assignment.coach.id === value)
  })
}

export function computeOrganizationCoachAssignmentCoverage(
  projects: PlatformAdminDashboardLabProject[]
): OrganizationCoachAssignmentCoverage {
  const organizations = new Map<string, ReadonlySet<string>>()
  for (const project of projects) {
    if (
      project.projectKind !== "organization_admin" ||
      !project.organizationId
    ) {
      continue
    }
    organizations.set(
      project.organizationId,
      new Set(
        (project.organizationCoachAssignments ?? []).map(
          (assignment) => assignment.coach.id
        )
      )
    )
  }

  const countByCoachId: Record<string, number> = {}
  let coveredOrganizations = 0
  let assignmentCount = 0
  for (const coachIds of organizations.values()) {
    if (coachIds.size > 0) coveredOrganizations += 1
    assignmentCount += coachIds.size
    for (const coachId of coachIds) {
      countByCoachId[coachId] = (countByCoachId[coachId] ?? 0) + 1
    }
  }

  return {
    totalOrganizations: organizations.size,
    coveredOrganizations,
    unassignedOrganizations: organizations.size - coveredOrganizations,
    assignmentCount,
    countByCoachId,
  }
}

export function defaultOrganizationCoachFilter(coach: OrganizationCoachOption) {
  const names = new Set(["joel", "paula", "caleb", "fs"])
  const firstName = coach.name.trim().split(/\s+/)[0].toLowerCase()
  const mailbox = coach.email?.split("@")[0].toLowerCase()
  return names.has(firstName) || (mailbox && names.has(mailbox)) ? coach.id : "all"
}
