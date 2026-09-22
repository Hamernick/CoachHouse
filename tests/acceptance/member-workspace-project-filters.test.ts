import { describe, expect, it } from "vitest"

import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import {
  computeMemberWorkspaceProjectFilterCounts,
  filterMemberWorkspaceProjects,
} from "@/features/member-workspace/components/projects/member-workspace-project-filters"
import { getMemberWorkspaceProjectBoardColumnOrder } from "@/features/member-workspace/components/projects/member-workspace-project-board-view"
import {
  applyViewOptionsToParams,
  chipsToParams,
  paramsToChips,
  DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS,
  paramsToViewOptions,
} from "@/features/member-workspace/components/projects/member-workspace-project-view-options"

function createProject(
  overrides: Partial<PlatformAdminDashboardLabProject>
): PlatformAdminDashboardLabProject {
  return {
    id: overrides.id ?? "project-1",
    name: overrides.name ?? "Project",
    taskCount: overrides.taskCount ?? 0,
    progress: overrides.progress ?? 0,
    startDate: overrides.startDate ?? new Date("2026-04-01T00:00:00.000Z"),
    endDate: overrides.endDate ?? new Date("2026-04-30T00:00:00.000Z"),
    status: overrides.status ?? "planned",
    fiscalSponsorshipStatus: overrides.fiscalSponsorshipStatus,
    priority: overrides.priority ?? "medium",
    tags: overrides.tags ?? [],
    members: overrides.members ?? [],
    client: overrides.client,
    typeLabel: overrides.typeLabel,
    durationLabel: overrides.durationLabel,
    tasks: overrides.tasks ?? [],
  }
}

describe("member workspace project filters", () => {
  it("searches organization names with existing filters and matching facet counts", () => {
    const projects = [
      createProject({ id: "match", name: "North House", priority: "high" }),
      createProject({
        id: "other-priority",
        name: "North Center",
        priority: "low",
      }),
      createProject({
        id: "other-name",
        name: "South House",
        priority: "high",
      }),
    ]
    const options = {
      projects,
      filters: [
        { key: "Search", value: "  NORTH  " },
        { key: "Priority", value: "High" },
      ],
      viewOptions: DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS,
    }
    expect(
      filterMemberWorkspaceProjects(options).map((project) => project.id)
    ).toEqual(["match"])
    expect(computeMemberWorkspaceProjectFilterCounts(options).priority).toEqual(
      { high: 1, low: 1 }
    )
    expect(
      filterMemberWorkspaceProjects({
        ...options,
        filters: [{ key: "Search", value: "missing" }],
      })
    ).toEqual([])
    expect(
      filterMemberWorkspaceProjects({
        ...options,
        filters: [{ key: "Search", value: "   " }],
      })
    ).toHaveLength(3)
  })

  it("preserves organization search punctuation in URL round trips", () => {
    const chips = [{ key: "Search", value: "House, Inc." }]
    expect(paramsToChips(chipsToParams(chips))).toEqual(chips)
  })

  it("matches members exactly instead of by substring", () => {
    const projects = [
      createProject({
        id: "project-ann",
        name: "Ann Project",
        members: ["Ann"],
      }),
      createProject({
        id: "project-joanne",
        name: "Joanne Project",
        members: ["Joanne"],
      }),
    ]

    const filteredProjects = filterMemberWorkspaceProjects({
      filters: [{ key: "Member", value: "Ann" }],
      projects,
      viewOptions: DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS,
    })

    expect(filteredProjects.map((project) => project.id)).toEqual([
      "project-ann",
    ])
  })

  it("keeps legacy project status URLs compatible with organization stages", () => {
    const projects = [
      createProject({ id: "project-onboarding", status: "planned" }),
      createProject({ id: "project-active", status: "active" }),
    ]

    const filteredProjects = filterMemberWorkspaceProjects({
      filters: [{ key: "Status", value: "Planned" }],
      projects,
      viewOptions: DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS,
    })

    expect(filteredProjects.map((project) => project.id)).toEqual([
      "project-onboarding",
    ])
  })

  it("keeps facet counts stable by excluding the active category filter from that facet", () => {
    const projects = [
      createProject({
        id: "project-1",
        status: "planned",
        priority: "high",
        members: ["Paula"],
        tags: ["onboarding"],
      }),
      createProject({
        id: "project-2",
        status: "active",
        priority: "high",
        members: ["Paula"],
        tags: ["onboarding"],
      }),
      createProject({
        id: "project-3",
        status: "completed",
        priority: "low",
        members: ["Joel"],
        tags: ["documents"],
      }),
    ]

    const counts = computeMemberWorkspaceProjectFilterCounts({
      filters: [{ key: "Status", value: "Onboarding" }],
      projects,
      viewOptions: DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS,
    })

    expect(counts.status).toMatchObject({
      onboarding: 1,
      active: 1,
      archived: 1,
    })
    expect(counts.priority).toMatchObject({
      high: 1,
    })
  })

  it("filters fiscal sponsorship independently from organization status", () => {
    const projects = [
      createProject({
        id: "project-eligible",
        status: "planned",
        fiscalSponsorshipStatus: "eligible",
      }),
      createProject({
        id: "project-active",
        status: "planned",
        fiscalSponsorshipStatus: "active",
      }),
    ]

    const filteredProjects = filterMemberWorkspaceProjects({
      filters: [{ key: "Fiscal Sponsorship", value: "Active" }],
      projects,
      viewOptions: DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS,
    })
    const counts = computeMemberWorkspaceProjectFilterCounts({
      filters: [{ key: "Fiscal Sponsorship", value: "Active" }],
      projects,
      viewOptions: DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS,
    })

    expect(filteredProjects.map((project) => project.id)).toEqual([
      "project-active",
    ])
    expect(counts.fiscalSponsorship).toEqual({ eligible: 1, active: 1 })
  })

  it("respects showClosedProjects when computing filtered results and counts", () => {
    const projects = [
      createProject({
        id: "project-open",
        status: "active",
        members: [],
      }),
      createProject({
        id: "project-closed",
        status: "completed",
        members: [],
      }),
    ]

    const viewOptions = {
      ...DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS,
      showClosedProjects: false,
    }

    const filteredProjects = filterMemberWorkspaceProjects({
      filters: [],
      projects,
      viewOptions,
    })
    const counts = computeMemberWorkspaceProjectFilterCounts({
      filters: [],
      projects,
      viewOptions,
    })

    expect(filteredProjects.map((project) => project.id)).toEqual([
      "project-open",
    ])
    expect(counts.status).toMatchObject({
      active: 1,
    })
    expect(counts.status?.completed).toBeUndefined()
  })

  it("parses and serializes view options through URL params", () => {
    const params = new URLSearchParams(
      "view=board&order=date&closed=hide&properties=title,assignee"
    )

    const viewOptions = paramsToViewOptions(params)

    expect(viewOptions).toEqual({
      ...DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS,
      viewType: "board",
      ordering: "date",
      showClosedProjects: false,
      properties: ["title", "assignee"],
    })

    const nextParams = applyViewOptionsToParams(
      new URLSearchParams(),
      viewOptions
    )

    expect(nextParams.toString()).toBe(
      "view=board&order=date&closed=hide&properties=title%2Cassignee"
    )
  })

  it("persists hidden protected board categories in the URL", () => {
    const viewOptions = paramsToViewOptions(
      new URLSearchParams(
        "view=board&hidden-categories=planned,review_approval,INVALID!,planned"
      )
    )

    expect(viewOptions.hiddenWorkstreamCategoryKeys).toEqual([
      "planned",
      "review_approval",
    ])

    const nextParams = applyViewOptionsToParams(
      new URLSearchParams(),
      viewOptions
    )

    expect(nextParams.get("hidden-categories")).toBe("planned,review_approval")
  })

  it("includes closed board columns only when showClosedProjects is enabled", () => {
    expect(getMemberWorkspaceProjectBoardColumnOrder(false)).toEqual([
      "backlog",
      "planned",
      "active",
    ])

    expect(getMemberWorkspaceProjectBoardColumnOrder(true)).toEqual([
      "backlog",
      "planned",
      "active",
      "completed",
      "cancelled",
    ])
  })
})
