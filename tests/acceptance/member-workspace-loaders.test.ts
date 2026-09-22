import { beforeEach, describe, expect, it, vi } from "vitest"

const { resolveMemberWorkspaceActorContextMock } = vi.hoisted(() => ({
  resolveMemberWorkspaceActorContextMock: vi.fn(),
}))

const { loadAdminOrganizationSummariesMock } = vi.hoisted(() => ({
  loadAdminOrganizationSummariesMock: vi.fn(),
}))

const { ensureCanonicalAdminProjectsMock } = vi.hoisted(() => ({
  ensureCanonicalAdminProjectsMock: vi.fn(),
}))

const { loadAccessibleOrganizationsMock } = vi.hoisted(() => ({
  loadAccessibleOrganizationsMock: vi.fn(),
}))

const { loadMemberWorkspacePersonOptionsForOrganizationsMock } = vi.hoisted(
  () => ({
    loadMemberWorkspacePersonOptionsForOrganizationsMock: vi.fn(),
  })
)

const { ensureStarterTasksForOrgMock } = vi.hoisted(() => ({
  ensureStarterTasksForOrgMock: vi.fn(),
}))

const { loadFiscalSponsorshipProjectListStatusesMock } = vi.hoisted(() => ({
  loadFiscalSponsorshipProjectListStatusesMock: vi.fn(),
}))

vi.mock(
  "@/features/member-workspace/server/member-workspace-actor-context",
  () => ({
    resolveMemberWorkspaceActorContext: resolveMemberWorkspaceActorContextMock,
  })
)

vi.mock(
  "@/features/member-workspace/server/admin-organization-overview",
  () => ({
    loadAdminOrganizationSummaries: loadAdminOrganizationSummariesMock,
    mapAdminOrganizationSummaryToProject: (organization: {
      orgId: string
      canonicalProjectId: string | null
      name: string
      acceleratorProgress: number
      setupProgress: number
      setupCompletedCount: number
      setupTotalCount: number
      missingSetupCount: number
      tags: string[]
      members: Array<{ name: string }>
      ownerName: string
      ownerAvatarUrl: string | null
      setupItems: Array<{ id: string; label: string; complete: boolean }>
      publicSlug: string | null
      isPublic: boolean
      organizationStatus: string
      createdAt: string
    }) => ({
      id: organization.canonicalProjectId ?? organization.orgId,
      organizationId: organization.orgId,
      projectKind: "organization_admin",
      name: organization.name,
      taskCount: organization.setupTotalCount,
      progress: organization.acceleratorProgress,
      startDate: new Date(organization.createdAt),
      endDate: new Date(organization.createdAt),
      status: "active",
      priority: "medium",
      tags: organization.tags,
      members: organization.members.map((member) => member.name),
      primaryPersonName: organization.ownerName,
      primaryPersonAvatarUrl: organization.ownerAvatarUrl,
      client: organization.publicSlug,
      typeLabel: organization.organizationStatus,
      durationLabel: null,
      taskSummaryLabel: "Setup items",
      tasks: organization.setupItems.map((item) => ({
        id: item.id,
        name: item.label,
        type: "task",
        assignee: organization.ownerName,
        status: item.complete ? "done" : "todo",
        startDate: new Date(organization.createdAt),
        endDate: new Date(organization.createdAt),
      })),
    }),
  })
)

vi.mock("@/features/member-workspace/server/admin-projects", () => ({
  ensureCanonicalAdminProjects: ensureCanonicalAdminProjectsMock,
  attachCanonicalProjectIdsToOrganizations: ({
    canonicalProjects,
    organizations,
  }: {
    canonicalProjects: Array<{
      id: string
      canonical_org_id?: string | null
      org_id: string
    }>
    organizations: Array<Record<string, unknown>>
  }) => {
    const projectIdByOrgId = new Map(
      canonicalProjects.map((project) => [
        project.canonical_org_id ?? project.org_id,
        project.id,
      ])
    )

    return organizations.map((organization) => ({
      ...organization,
      canonicalProjectId:
        projectIdByOrgId.get(String(organization.orgId)) ?? null,
    }))
  },
}))

vi.mock(
  "@/features/member-workspace/server/load-accessible-organizations",
  () => ({
    loadAccessibleOrganizations: loadAccessibleOrganizationsMock,
  })
)

vi.mock("@/features/member-workspace/server/person-options", () => ({
  loadMemberWorkspacePersonOptionsForOrganizations:
    loadMemberWorkspacePersonOptionsForOrganizationsMock,
}))

vi.mock("@/features/member-workspace/server/task-persistence", () => ({
  ensureStarterTasksForOrg: ensureStarterTasksForOrgMock,
}))

vi.mock(
  "@/features/member-workspace/server/fiscal-sponsorship-project-list-status",
  () => ({
    loadFiscalSponsorshipProjectListStatuses:
      loadFiscalSponsorshipProjectListStatusesMock,
  })
)

import { loadMemberWorkspaceProjectsPage } from "@/features/member-workspace/server/project-loaders"
import { loadMemberWorkspaceTasksPage } from "@/features/member-workspace/server/task-loaders"

const missingProjectsTableError = {
  code: "PGRST205",
  message:
    "Could not find the table 'public.organization_projects' in the schema cache",
}

const missingTasksTableError = {
  code: "42P01",
  message: 'relation "organization_tasks" does not exist',
}

function createProjectsMissingTableSupabase() {
  let projectCalls = 0

  const projectCountQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn(() =>
      Promise.resolve({
        count: null,
        error: missingProjectsTableError,
      })
    ),
  }

  const projectListQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    returns: vi.fn(() =>
      Promise.resolve({
        data: null,
        error: missingProjectsTableError,
      })
    ),
  }

  return {
    from: vi.fn((table: string) => {
      if (table === "organization_projects") {
        projectCalls += 1
        return projectCalls === 1 ? projectCountQuery : projectListQuery
      }

      throw new Error(`Unexpected table query: ${table}`)
    }),
  }
}

function createTasksMissingTableSupabase() {
  const taskCountQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    returns: vi.fn(() =>
      Promise.resolve({
        data: null,
        error: missingTasksTableError,
      })
    ),
  }

  const assigneeQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    returns: vi.fn(() =>
      Promise.resolve({
        data: null,
        error: {
          code: "42P01",
          message: 'relation "organization_task_assignees" does not exist',
        },
      })
    ),
  }

  const projectOptionsQuery = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    returns: vi.fn(() =>
      Promise.resolve({
        data: [],
        error: null,
      })
    ),
  }

  return {
    from: vi.fn((table: string) => {
      if (table === "organization_projects") {
        return projectOptionsQuery
      }
      if (table === "organizations") {
            return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), returns: vi.fn().mockResolvedValue({ data: [{ user_id: "org-1", profile: { name: "Test Organization" } }], error: null }) }
          }
          if (table === "organization_tasks") {
        return taskCountQuery
      }
      if (table === "organization_task_assignees") {
        return assigneeQuery
      }

      throw new Error(`Unexpected table query: ${table}`)
    }),
  }
}

describe("member workspace loaders", () => {
  beforeEach(() => {
    resolveMemberWorkspaceActorContextMock.mockReset()
    loadAdminOrganizationSummariesMock.mockReset()
    ensureCanonicalAdminProjectsMock.mockReset()
    loadAccessibleOrganizationsMock.mockReset()
    loadMemberWorkspacePersonOptionsForOrganizationsMock.mockReset()
    loadMemberWorkspacePersonOptionsForOrganizationsMock.mockResolvedValue([])
    ensureStarterTasksForOrgMock.mockReset()
    ensureStarterTasksForOrgMock.mockResolvedValue(undefined)
    loadFiscalSponsorshipProjectListStatusesMock.mockReset()
    loadFiscalSponsorshipProjectListStatusesMock.mockResolvedValue(new Map())
  })

  it("returns an empty projects state when member workspace project tables are missing", async () => {
    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase: createProjectsMissingTableSupabase(),
      userId: "user-1",
      activeOrg: { orgId: "org-1", role: "owner" },
      isAdmin: false,
      canEdit: true,
    })
    loadAccessibleOrganizationsMock.mockResolvedValue([
      { orgId: "org-1", name: "Org One", role: "owner", publicSlug: "org-one" },
    ])

    await expect(loadMemberWorkspaceProjectsPage()).resolves.toEqual({
      projects: [],
      storageMode: "empty",
      starterProjectCount: 0,
      hasUserProjects: false,
      canResetStarterData: false,
      canCreateProjects: true,
      scope: "organization",
      organizationOptions: [{ orgId: "org-1", name: "Org One" }],
      assigneeOptions: [],
      workstreamCategories: [],
    })
  })

  it("returns a global admin projects state for platform admins", async () => {
    loadAdminOrganizationSummariesMock.mockResolvedValue([
      {
        orgId: "org-1",
        canonicalProjectId: null,
        name: "Community Builders",
        ownerName: "Paula Founder",
        ownerAvatarUrl: null,
        acceleratorProgress: 42,
        setupProgress: 68,
        setupCompletedCount: 8,
        setupTotalCount: 10,
        missingSetupCount: 2,
        tags: ["organization", "approved"],
        members: [{ name: "Paula" }],
        setupItems: [
          { id: "mission", label: "Add mission statement", complete: true },
          {
            id: "roadmap-program",
            label: "Complete roadmap: Program",
            complete: false,
          },
        ],
        publicSlug: "community-builders",
        isPublic: true,
        organizationStatus: "approved",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ])
    ensureCanonicalAdminProjectsMock.mockResolvedValue([
      {
        id: "project-1",
        org_id: "org-1",
        canonical_org_id: "org-1",
        project_kind: "organization_admin",
        name: "Community Builders",
        status: "active",
        priority: "medium",
        progress: 68,
        start_date: "2026-01-01",
        end_date: "2026-01-15",
        client_name: "community-builders",
        type_label: "approved",
        duration_label: null,
        tags: ["organization", "approved"],
        member_labels: ["Paula"],
        task_count: 2,
        created_source: "system",
        starter_seed_key: null,
        starter_seed_version: null,
        created_by: "org-1",
        updated_by: "org-1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ])
    const standardProjectsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [],
          error: null,
        })
      ),
    }
    const missingWorkstreamCategoriesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: null,
          error: { code: "42P01" },
        })
      ),
    }

    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase: {
        from: vi.fn((table: string) => {
          if (table === "organization_projects") {
            return standardProjectsQuery
          }
          if (table === "platform_admin_workstream_categories") {
            return missingWorkstreamCategoriesQuery
          }
          throw new Error(`Unexpected table query: ${table}`)
        }),
      },
      userId: "admin-1",
      isAdmin: true,
      activeOrg: { orgId: "org-1", role: "owner" },
      canEdit: true,
    })

    await expect(loadMemberWorkspaceProjectsPage()).resolves.toMatchObject({
      storageMode: "custom",
      starterProjectCount: 0,
      hasUserProjects: true,
      canResetStarterData: false,
      canCreateProjects: true,
      scope: "platform-admin",
      organizationOptions: [{ orgId: "org-1", name: "Community Builders" }],
      assigneeOptions: [],
      projects: [
        expect.objectContaining({
          id: "project-1",
          name: "Community Builders",
          progress: 68,
          taskCount: 2,
          projectKind: "organization_admin",
        }),
      ],
    })
    expect(standardProjectsQuery.neq).toHaveBeenCalledWith(
      "created_source",
      "starter_seed"
    )
  })

  it("returns manageable platform-admin task views for real projects", async () => {
    let organizationProjectsCalls = 0
    const orgRowsQuery = {
      select: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [{ id: "project-standard", org_id: "org-1" }],
          error: null,
        })
      ),
    }
    const adminProjectOptionsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "project-standard",
              name: "Client Migration",
              project_kind: "standard",
              created_source: "user",
            },
          ],
          error: null,
        })
      ),
    }
    const adminTaskRowsQuery = {
      or: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "task-standard",
              created_by: "platform-admin-1",
              org_id: "org-1",
              project_id: "project-standard",
              title: "Prepare launch",
              description: null,
              task_type: "task",
              status: "todo",
              start_date: "2026-04-01",
              end_date: "2026-04-02",
              priority: "medium",
              tag_label: null,
              workstream_name: null,
              sort_order: 0,
              created_source: "user",
              organization_projects: {
                id: "project-standard",
                name: "Client Migration",
                client_name: null,
                status: "planned",
                priority: "medium",
                tags: [],
                member_labels: [],
                type_label: null,
                duration_label: null,
                start_date: "2026-04-01",
                end_date: "2026-04-30",
              },
            },
            {
              id: "task-system",
              org_id: "org-1",
              project_id: "project-system",
              title: "Internal system task",
              description: null,
              task_type: "task",
              status: "todo",
              start_date: "2026-04-01",
              end_date: "2026-04-02",
              priority: "medium",
              tag_label: null,
              workstream_name: null,
              sort_order: 0,
              created_source: "system",
              organization_projects: null,
            },
          ],
          error: null,
        })
      ),
    }
    const taskAssigneesQuery = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      returns: vi.fn(() => Promise.resolve({ data: [], error: null })),
    }

    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase: {
        from: vi.fn((table: string) => {
          if (table === "organization_projects") {
            organizationProjectsCalls += 1
            return organizationProjectsCalls === 1
              ? orgRowsQuery
              : adminProjectOptionsQuery
          }
          if (table === "organizations") {
            return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), returns: vi.fn().mockResolvedValue({ data: [{ user_id: "org-1", profile: { name: "Test Organization" } }], error: null }) }
          }
          if (table === "organization_tasks") {
            return adminTaskRowsQuery
          }
          if (table === "organization_task_assignees") {
            return taskAssigneesQuery
          }
          throw new Error(`Unexpected table query: ${table}`)
        }),
      },
      userId: "platform-admin-1",
      isAdmin: true,
      activeOrg: { orgId: "org-1", role: "owner" },
      canEdit: true,
    })

    await expect(loadMemberWorkspaceTasksPage()).resolves.toMatchObject({
      scope: "platform-admin",
      canManageTasks: true,
      projectOptions: [{ id: "project-standard", label: "Client Migration" }],
      taskGroups: [
        expect.objectContaining({
          projectId: "project-standard",
          tasks: [
            expect.objectContaining({
              id: "task-standard",
              canUpdate: true,
            }),
          ],
        }),
      ],
    })

    expect(adminProjectOptionsQuery.in).toHaveBeenCalledWith("project_kind", [
      "standard",
      "organization_admin",
    ])
  })

  it("returns an empty tasks state when member workspace task tables are missing", async () => {
    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase: createTasksMissingTableSupabase(),
      userId: "user-1",
      activeOrg: { orgId: "org-1", role: "owner" },
      canEdit: true,
    })

    await expect(loadMemberWorkspaceTasksPage()).resolves.toEqual({
      taskGroups: [],
      storageMode: "empty",
      starterTaskCount: 0,
      hasAnyOrgTasks: false,
      canResetStarterData: false,
      canManageTasks: true,
      scope: "organization",
      assigneeOptions: [],
      projectOptions: [],
    })
  })

  it("filters member task project options down to standard non-system projects", async () => {
    const projectOptionsQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "project-standard",
              name: "Client Migration",
              project_kind: "standard",
              created_source: "user",
            },
          ],
          error: null,
        })
      ),
    }

    const organizationTasksQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [],
          error: null,
        })
      ),
    }

    const assigneesQuery = {
      in: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [],
          error: null,
        })
      ),
    }

    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase: {
        from: vi.fn((table: string) => {
          if (table === "organization_projects") {
            return projectOptionsQuery
          }
          if (table === "organizations") {
            return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), returns: vi.fn().mockResolvedValue({ data: [{ user_id: "org-1", profile: { name: "Test Organization" } }], error: null }) }
          }
          if (table === "organization_tasks") {
            return organizationTasksQuery
          }
          if (table === "organization_task_assignees") {
            return assigneesQuery
          }
          throw new Error(`Unexpected table query: ${table}`)
        }),
      },
      userId: "user-1",
      currentUser: {
        id: "user-1",
        name: "Owner",
        email: null,
        avatarUrl: null,
        displayImage: null,
      },
      activeOrg: { orgId: "org-1", role: "owner" },
      isAdmin: false,
      canEdit: true,
    })

    await expect(loadMemberWorkspaceTasksPage()).resolves.toMatchObject({
      scope: "organization",
      projectOptions: [{ id: "project-standard", label: "Client Migration" }],
    })

    expect(projectOptionsQuery.eq).toHaveBeenNthCalledWith(
      1,
      "project_kind",
      "standard"
    )
    expect(projectOptionsQuery.eq).toHaveBeenNthCalledWith(2, "org_id", "org-1")
    expect(projectOptionsQuery.neq).toHaveBeenCalledWith(
      "created_source",
      "system"
    )
  })

  it("ignores org tasks that belong to admin/system projects outside the member-workspace scope", async () => {
    const projectOptionsQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "project-standard",
              name: "Client Migration",
              project_kind: "standard",
              created_source: "user",
            },
          ],
          error: null,
        })
      ),
    }

    const organizationTasksQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "task-allowed",
              project_id: "project-standard",
              created_source: "starter_seed",
            },
            {
              id: "task-admin",
              project_id: "project-admin",
              created_source: "user",
            },
          ],
          error: null,
        })
      ),
    }

    const assigneesQuery = {
      in: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              task_id: "task-allowed",
              user_id: "user-1",
              organization_tasks: {
                id: "task-allowed",
                org_id: "org-1",
                project_id: "project-standard",
                title: "Starter task",
                description: null,
                task_type: "task",
                status: "todo",
                start_date: "2026-04-01",
                end_date: "2026-04-02",
                priority: "medium",
                tag_label: null,
                workstream_name: null,
                sort_order: 0,
                created_source: "starter_seed",
                starter_seed_key: null,
                starter_seed_version: null,
                created_by: "user-1",
                updated_by: "user-1",
                created_at: "2026-04-01T00:00:00.000Z",
                updated_at: "2026-04-01T00:00:00.000Z",
                organization_projects: {
                  id: "project-standard",
                  name: "Client Migration",
                  client_name: null,
                  status: "planned",
                  priority: "medium",
                  tags: [],
                  member_labels: [],
                  type_label: null,
                  duration_label: null,
                  start_date: "2026-04-01",
                  end_date: "2026-04-30",
                },
              },
            },
            {
              task_id: "task-admin",
              user_id: "user-1",
              organization_tasks: {
                id: "task-admin",
                org_id: "org-1",
                project_id: "project-admin",
                title: "Admin-only task",
                description: null,
                task_type: "task",
                status: "todo",
                start_date: "2026-04-01",
                end_date: "2026-04-02",
                priority: "medium",
                tag_label: null,
                workstream_name: null,
                sort_order: 1,
                created_source: "user",
                starter_seed_key: null,
                starter_seed_version: null,
                created_by: "user-1",
                updated_by: "user-1",
                created_at: "2026-04-01T00:00:00.000Z",
                updated_at: "2026-04-01T00:00:00.000Z",
                organization_projects: {
                  id: "project-admin",
                  name: "Canonical Org Project",
                  client_name: null,
                  status: "active",
                  priority: "medium",
                  tags: [],
                  member_labels: [],
                  type_label: null,
                  duration_label: null,
                  start_date: "2026-04-01",
                  end_date: "2026-04-30",
                },
              },
            },
          ],
          error: null,
        })
      ),
    }

    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase: {
        from: vi.fn((table: string) => {
          if (table === "organization_projects") {
            return projectOptionsQuery
          }
          if (table === "organizations") {
            return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), returns: vi.fn().mockResolvedValue({ data: [{ user_id: "org-1", profile: { name: "Test Organization" } }], error: null }) }
          }
          if (table === "organization_tasks") {
            return organizationTasksQuery
          }
          if (table === "organization_task_assignees") {
            return assigneesQuery
          }
          throw new Error(`Unexpected table query: ${table}`)
        }),
      },
      userId: "user-1",
      currentUser: {
        id: "user-1",
        name: "Owner",
        email: null,
        avatarUrl: null,
        displayImage: null,
      },
      activeOrg: { orgId: "org-1", role: "owner" },
      isAdmin: false,
      canEdit: true,
    })

    await expect(loadMemberWorkspaceTasksPage()).resolves.toMatchObject({
      scope: "organization",
      starterTaskCount: 1,
      hasAnyOrgTasks: true,
      projectOptions: [{ id: "project-standard", label: "Client Migration" }],
      taskGroups: [
        expect.objectContaining({
          projectId: "project-standard",
          tasks: [
            expect.objectContaining({
              id: "task-allowed",
              title: "Starter task",
            }),
          ],
        }),
      ],
    })
  })
})
