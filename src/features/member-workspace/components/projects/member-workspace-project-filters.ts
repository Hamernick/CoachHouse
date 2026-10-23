import { comparePresentationDates } from "../../lib/presentation-date-order"
import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import type {
  MemberWorkspaceProjectFilterChip,
  MemberWorkspaceProjectViewOptions,
} from "./member-workspace-project-view-options"
import {
  normalizeMemberWorkspaceOrganizationStatusFilterValue,
  normalizeProjectStatusFilter,
  projectDirectoryFilters,
  resolveMemberWorkspaceOrganizationStatus,
} from "./member-workspace-project-status"

export type MemberWorkspaceProjectFilterCounts = {
  status?: Record<string, number>
  fiscalSponsorship?: Record<string, number>
  priority?: Record<string, number>
  tags?: Record<string, number>
  members?: Record<string, number>
}

type FilterBuckets = {
  search: Set<string>
  status: Set<string>
  fiscalSponsorship: Set<string>
  priority: Set<string>
  tags: Set<string>
  members: Set<string>
}

type FilterCategory = keyof FilterBuckets

function normalizeFilterBuckets(
  filters: MemberWorkspaceProjectFilterChip[],
  directory: "organizations" | "projects",
): FilterBuckets {
  const buckets: FilterBuckets = {
    search: new Set<string>(),
    status: new Set<string>(),
    fiscalSponsorship: new Set<string>(),
    priority: new Set<string>(),
    tags: new Set<string>(),
    members: new Set<string>(),
  }

  for (const { key, value } of filters) {
    const normalizedKey = key.trim().toLowerCase()
    const normalizedValue = value.trim().toLowerCase()

    if (normalizedKey === "search" && normalizedValue) {
      buckets.search.add(normalizedValue)
      continue
    }

    if (normalizedKey.startsWith("fiscal sponsorship")) {
      buckets.fiscalSponsorship.add(normalizedValue.replaceAll(" ", "_"))
      continue
    }

    if (normalizedKey.startsWith("status")) {
      const status =
        (directory === "projects" ? normalizeProjectStatusFilter : normalizeMemberWorkspaceOrganizationStatusFilterValue)(normalizedValue)
      if (status) buckets.status.add(status)
      continue
    }

    if (normalizedKey.startsWith("priority")) {
      buckets.priority.add(normalizedValue)
      continue
    }

    if (normalizedKey.startsWith("tag")) {
      buckets.tags.add(normalizedValue)
      continue
    }

    if (normalizedKey === "pic" || normalizedKey.startsWith("member")) {
      buckets.members.add(normalizedValue)
    }
  }

  return buckets
}

function applyVisibilityFilters(
  projects: PlatformAdminDashboardLabProject[],
  viewOptions: MemberWorkspaceProjectViewOptions
) {
  return projects.filter(project => {
    if (!viewOptions.showClosedProjects && ["completed", "cancelled"].includes(project.status)) return false
    if (viewOptions.completion === "completed") return project.status === "completed"
    if (viewOptions.completion === "incomplete") return project.status !== "completed"
    return true
  })
}

function matchesExactMember(
  project: PlatformAdminDashboardLabProject,
  members: Set<string>
) {
  const includesNoMember = members.has("no member")
  if (includesNoMember && project.members.length === 0) {
    return true
  }

  const projectMembers = new Set(
    project.members.map((member) => member.trim().toLowerCase())
  )

  for (const value of members) {
    if (value === "no member") continue
    if (projectMembers.has(value)) {
      return true
    }
  }

  return false
}

function applyCategoryFilters({
  directory,
  excludeCategory,
  filters,
  projects,
}: {
  directory: "organizations" | "projects"
  excludeCategory?: FilterCategory
  filters: FilterBuckets
  projects: PlatformAdminDashboardLabProject[]
}) {
  let list = projects.slice()

  if (filters.search.size > 0) {
    list = list.filter((project) =>
      Array.from(filters.search).every((query) =>
        project.name.toLowerCase().includes(query)
      )
    )
  }

  if (excludeCategory !== "status" && filters.status.size > 0) {
    list = list.filter((project) =>
      filters.status.has(
        directory === "projects" ? project.status : resolveMemberWorkspaceOrganizationStatus(project.status)
      )
    )
  }

  if (
    excludeCategory !== "fiscalSponsorship" &&
    filters.fiscalSponsorship.size > 0
  ) {
    list = list.filter(
      (project) =>
        Boolean(project.fiscalSponsorshipStatus) &&
        filters.fiscalSponsorship.has(project.fiscalSponsorshipStatus ?? "")
    )
  }

  if (excludeCategory !== "priority" && filters.priority.size > 0) {
    list = list.filter((project) =>
      filters.priority.has(project.priority.toLowerCase())
    )
  }

  if (excludeCategory !== "tags" && filters.tags.size > 0) {
    list = list.filter((project) =>
      project.tags.some((tag) => filters.tags.has(tag.toLowerCase()))
    )
  }

  if (excludeCategory !== "members" && filters.members.size > 0) {
    list = list.filter((project) =>
      matchesExactMember(project, filters.members)
    )
  }

  return list
}

function sortProjects(
  projects: PlatformAdminDashboardLabProject[],
  viewOptions: MemberWorkspaceProjectViewOptions
) {
  const sorted = projects.slice()

  if (viewOptions.ordering === "alphabetical") {
    sorted.sort((left, right) => left.name.localeCompare(right.name))
  }

  if (viewOptions.ordering === "date") {
    sorted.sort(
      (left, right) => comparePresentationDates(left.endDate, right.endDate)
    )
  }

  if (viewOptions.ordering === "added") {
    sorted.sort((left, right) => comparePresentationDates(left.createdAt, right.createdAt, true))
  }

  return sorted
}

function countProjectsByCategory(
  projects: PlatformAdminDashboardLabProject[],
  directory: "organizations" | "projects",
): MemberWorkspaceProjectFilterCounts {
  const counts: MemberWorkspaceProjectFilterCounts = {
    status: {},
    fiscalSponsorship: {},
    priority: {},
    tags: {},
    members: {},
  }

  for (const project of projects) {
    const organizationStatus = directory === "projects" ? project.status : resolveMemberWorkspaceOrganizationStatus(project.status)
    counts.status![organizationStatus] =
      (counts.status![organizationStatus] ?? 0) + 1
    if (project.fiscalSponsorshipStatus) {
      counts.fiscalSponsorship![project.fiscalSponsorshipStatus] =
        (counts.fiscalSponsorship![project.fiscalSponsorshipStatus] ?? 0) + 1
    }
    counts.priority![project.priority] =
      (counts.priority![project.priority] ?? 0) + 1

    for (const tag of project.tags) {
      const key = tag.toLowerCase()
      counts.tags![key] = (counts.tags![key] ?? 0) + 1
    }

    if (project.members.length === 0) {
      counts.members!["no member"] = (counts.members!["no member"] ?? 0) + 1
    }

    for (const member of project.members) {
      const key = member.toLowerCase()
      counts.members![key] = (counts.members![key] ?? 0) + 1
    }
  }

  return counts
}

export function filterMemberWorkspaceProjects({
  directory = "organizations",
  filters,
  projects,
  viewOptions,
}: {
  directory?: "organizations" | "projects"
  filters: MemberWorkspaceProjectFilterChip[]
  projects: PlatformAdminDashboardLabProject[]
  viewOptions: MemberWorkspaceProjectViewOptions
}) {
  const normalizedFilters = normalizeFilterBuckets(directory === "projects" ? projectDirectoryFilters(filters) : filters, directory)
  const visibleProjects = applyVisibilityFilters(projects, viewOptions)
  const filteredProjects = applyCategoryFilters({
    directory,
    filters: normalizedFilters,
    projects: visibleProjects,
  })

  return sortProjects(filteredProjects, viewOptions)
}

export function computeMemberWorkspaceProjectFilterCounts({
  directory = "organizations",
  filters,
  projects,
  viewOptions,
}: {
  directory?: "organizations" | "projects"
  filters: MemberWorkspaceProjectFilterChip[]
  projects: PlatformAdminDashboardLabProject[]
  viewOptions: MemberWorkspaceProjectViewOptions
}) {
  const normalizedFilters = normalizeFilterBuckets(directory === "projects" ? projectDirectoryFilters(filters) : filters, directory)
  const visibleProjects = applyVisibilityFilters(projects, viewOptions)

  return {
    status: countProjectsByCategory(
      applyCategoryFilters({
        directory,
        excludeCategory: "status",
        filters: normalizedFilters,
        projects: visibleProjects,
      }), directory
    ).status,
    fiscalSponsorship: countProjectsByCategory(
      applyCategoryFilters({
        directory,
        excludeCategory: "fiscalSponsorship",
        filters: normalizedFilters,
        projects: visibleProjects,
      }), directory
    ).fiscalSponsorship,
    priority: countProjectsByCategory(
      applyCategoryFilters({
        directory,
        excludeCategory: "priority",
        filters: normalizedFilters,
        projects: visibleProjects,
      }), directory
    ).priority,
    tags: countProjectsByCategory(
      applyCategoryFilters({
        directory,
        excludeCategory: "tags",
        filters: normalizedFilters,
        projects: visibleProjects,
      }), directory
    ).tags,
    members: countProjectsByCategory(
      applyCategoryFilters({
        directory,
        excludeCategory: "members",
        filters: normalizedFilters,
        projects: visibleProjects,
      }), directory
    ).members,
  }
}
