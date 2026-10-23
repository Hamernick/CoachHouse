import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemberWorkspaceProjectFilterPopover } from "@/features/member-workspace/components/projects/member-workspace-project-filter-popover"
import { projectDirectoryFilters } from "@/features/member-workspace/components/projects/member-workspace-project-status"

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => children,
  PopoverTrigger: ({ children }: { children: ReactNode }) => children,
  PopoverContent: ({ children }: { children: ReactNode }) => children,
}))

import { restoreDirectoryQuery, saveDirectoryQuery } from "@/features/member-workspace/lib/directory-preferences"

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
    createdAt: overrides.createdAt,
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

describe("organization directory preferences", () => {
  const scope = { directory: "organizations" as const, viewerUserId: "coach-1" }

  function installStorage() {
    const values = new Map<string, string>()
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
  }

  afterEach(() => vi.unstubAllGlobals())

  it.each(["all", "coach-1", "unassigned"])(
    "restores %s when returning through a link without filters",
    (coach) => {
      installStorage()
      saveDirectoryQuery(scope, "", coach)
      expect(new URLSearchParams(restoreDirectoryQuery(scope, "")).get("coach")).toBe(coach)
    }
  )

  it("retains search, facets and view settings alongside the coach choice", () => {
    installStorage()
    const query = "search=House%2C+Inc.&priority=High&view=board&closed=hide"
    saveDirectoryQuery(scope, query, "all")
    const restored = new URLSearchParams(restoreDirectoryQuery(scope, ""))
    expect(paramsToChips(restored)).toEqual([
      { key: "Search", value: "House, Inc." },
      { key: "Priority", value: "High" },
    ])
    expect(paramsToViewOptions(restored)).toMatchObject({
      viewType: "board", showClosedProjects: false,
    })
  })

  it("honors an explicit URL over saved filters", () => {
    installStorage()
    saveDirectoryQuery(scope, "", "all")
    expect(restoreDirectoryQuery(scope, "coach=coach-1")).toBe("coach=coach-1")
  })

  it("keeps accounts and directories separate and leaves anonymous previews unsaved", () => {
    installStorage()
    saveDirectoryQuery(scope, "", "all")
    expect(restoreDirectoryQuery({ ...scope, viewerUserId: "coach-2" }, "")).toBe("")
    expect(restoreDirectoryQuery({ ...scope, directory: "projects" }, "")).toBe("")
    const preview = { directory: "organizations" as const }
    saveDirectoryQuery(preview, "", "all")
    expect(restoreDirectoryQuery(preview, "")).toBe("")
  })

  it("remembers clearing filters instead of bringing back the old selection", () => {
    installStorage()
    saveDirectoryQuery(scope, "search=old&priority=High", "coach-1")
    saveDirectoryQuery(scope, "", "all")
    expect(restoreDirectoryQuery(scope, "")).toBe("coach=all")
  })

  it("keeps filtering usable when browser storage access is denied", () => {
    vi.stubGlobal("window", {
      get localStorage() { throw new Error("Storage disabled") },
    })
    expect(() => saveDirectoryQuery(scope, "", "all")).not.toThrow()
    expect(restoreDirectoryQuery(scope, "")).toBe("")
    expect(restoreDirectoryQuery(scope, "coach=all")).toBe("coach=all")
  })
})

describe("member workspace project filters", () => {
  it.each(["backlog", "planned", "active", "completed", "cancelled"] as const)("filters the exact %s project status", status => {
    const projects = (["backlog", "planned", "active", "completed", "cancelled"] as const).map(status => createProject({ id: status, status }))
    const options = { directory: "projects" as const, projects, filters: [{ key: "Status", value: status }], viewOptions: DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS }
    expect(filterMemberWorkspaceProjects(options).map(project => project.id)).toEqual([status])
    expect(computeMemberWorkspaceProjectFilterCounts(options).status).toEqual({ backlog: 1, planned: 1, active: 1, completed: 1, cancelled: 1 })
  })

  it("combines real project members, tags and priority without fiscal sponsorship filtering", () => {
    const projects = [createProject({ id: "match", members: ["Ann"], tags: ["Finance"], priority: "high" }), createProject({ id: "different", members: ["Joanne"], tags: ["Finance"], priority: "high" })]
    expect(filterMemberWorkspaceProjects({ directory: "projects", projects, filters: [{ key: "Member", value: "Ann" }, { key: "Tag", value: "Finance" }, { key: "Priority", value: "High" }, { key: "Fiscal Sponsorship", value: "Active" }], viewOptions: DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS }).map(project => project.id)).toEqual(["match"])
  })

  it("migrates old organization status chips into explicit project states", () => {
    const filters = projectDirectoryFilters([{ key: "Status", value: "Onboarding" }, { key: "Status", value: "Archived" }, { key: "Fiscal Sponsorship", value: "Active" }])
    expect(filters.map(chip => chip.value)).toEqual(["Backlog", "Planned", "Completed", "Cancelled"])
    expect(paramsToChips(chipsToParams(filters))).toEqual(filters)
  })

  it("renders project status choices without organization coach or fiscal controls", () => {
    const markup = renderToStaticMarkup(createElement(MemberWorkspaceProjectFilterPopover, { directory: "projects", projects: [], coachOptions: [{ id: "coach", name: "Coach", email: null, avatarUrl: null }], onCoachFilterChange: () => {}, onApply: () => {}, onClear: () => {} }))
    expect(markup).toContain("Project status")
    for (const label of ["Backlog", "Planned", "Active", "Completed", "Cancelled", "Members"]) expect(markup).toContain(label)
    for (const label of ["Organization status", "Onboarding", "Archived", "Fiscal Sponsorship", "Filter organizations by coach"]) expect(markup).not.toContain(label)
  })

  it("places undated projects after scheduled ones when ordering by due date", () => {
    const projects = [createProject({ id: "unscheduled" }), createProject({ id: "scheduled" })]
    projects[0].startDate = null
    projects[0].endDate = null
    expect(filterMemberWorkspaceProjects({ projects, filters: [], viewOptions: { ...DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS, ordering: "date" } }).map((project) => project.id)).toEqual(["scheduled", "unscheduled"])
  })

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
      "on-hold",
    ])

    expect(getMemberWorkspaceProjectBoardColumnOrder(true)).toEqual([
      "backlog",
      "planned",
      "active",
      "on-hold",
      "completed",
      "cancelled",
    ])
  })
})


it("persists completion and added ordering and filters projects by actual completion", () => {
  const options = paramsToViewOptions(new URLSearchParams("completion=completed&order=added"))
  expect(paramsToViewOptions(applyViewOptionsToParams(new URLSearchParams(), options))).toEqual(options)
  const projects = [createProject({ id: "active", status: "active" }), createProject({ id: "done", status: "completed" }), createProject({ id: "cancelled", status: "cancelled" })]
  expect(filterMemberWorkspaceProjects({ directory: "projects", filters: [], projects, viewOptions: options }).map(project => project.id)).toEqual(["done"])
  expect(filterMemberWorkspaceProjects({ directory: "projects", filters: [], projects, viewOptions: { ...options, completion: "incomplete" } }).map(project => project.id)).toEqual(["active", "cancelled"])
})

it("sorts project creation timestamps independently of deadlines with missing dates last", () => {
  const projects = [
    createProject({ id: "unknown" }),
    createProject({ id: "old", createdAt: "2026-01-01T00:00:00Z", endDate: new Date("2026-12-31") }),
    createProject({ id: "new", createdAt: "2026-10-20T00:00:00Z", endDate: new Date("2027-01-01") }),
  ]
  expect(filterMemberWorkspaceProjects({ projects, filters: [], viewOptions: { ...DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS, ordering: "added" } }).map(project => project.id)).toEqual(["new", "old", "unknown"])
  expect(filterMemberWorkspaceProjects({ projects, filters: [], viewOptions: { ...DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS, ordering: "date" } }).map(project => project.id)).toEqual(["unknown", "old", "new"])
})
