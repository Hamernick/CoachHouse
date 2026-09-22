import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import {
  defaultOrganizationCoachFilter,
  applyOrganizationCoachFilterToParams,
  canAccessOrganizationInCoachScope,
  computeOrganizationCoachAssignmentCoverage,
  filterProjectsByOrganizationCoach,
  filterByOrganizationCoachScope,
  getOrganizationCoachInitials,
  getOrganizationCoachAssignmentsSignature,
  normalizeOrganizationCoachFilter,
} from "@/features/organization-coach-assignments"
import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"

const paula = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Paula Coach",
  email: "paula@example.com",
  avatarUrl: null,
}

const joel = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Joel Coach",
  email: "joel@example.com",
  avatarUrl: null,
}

const assignment = (coach: typeof paula) => ({
  organizationId: "org-1",
  coach,
  assignedBy: null,
  updatedAt: "2026-07-21T00:00:00.000Z",
})

function project(
  overrides: Partial<PlatformAdminDashboardLabProject> &
    Pick<PlatformAdminDashboardLabProject, "id" | "name">
): PlatformAdminDashboardLabProject {
  return {
    taskCount: 0,
    progress: 0,
    startDate: new Date("2026-07-21T00:00:00.000Z"),
    endDate: new Date("2026-07-21T00:00:00.000Z"),
    status: "active",
    priority: "medium",
    tags: [],
    members: [],
    tasks: [],
    ...overrides,
  }
}

describe("organization-coach-assignments feature contract", () => {
  it("builds compact coach initials", () => {
    expect(
      getOrganizationCoachInitials({
        id: "coach-id",
        name: "Paula Coach",
        email: null,
        avatarUrl: null,
      })
    ).toBe("PC")
  })

  it("treats recreated equivalent assignment props as stable", () => {
    const current = [assignment(paula)]
    const recreated = [assignment({ ...paula })]

    expect(getOrganizationCoachAssignmentsSignature(current)).toBe(
      getOrganizationCoachAssignmentsSignature(recreated)
    )
    expect(
      getOrganizationCoachAssignmentsSignature(current)
    ).not.toBe(getOrganizationCoachAssignmentsSignature([assignment(joel)]))
  })

  it("keeps writes developer-only and reads internal", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260721153000_add_organization_coach_assignments.sql"
      ),
      "utf8"
    )

    expect(migration).toContain("using ((select public.is_platform_staff()))")
    expect(migration).toContain("with check ((select public.is_admin()))")
    expect(migration).toContain("require_coach_assignment_access_level")
    expect(migration).toContain("prevent_assigned_coach_access_change")
    expect(migration).toContain("force row level security")
  })

  it("validates developer access again inside the server action", () => {
    const action = readFileSync(
      resolve(
        process.cwd(),
        "src/features/organization-coach-assignments/server/actions.ts"
      ),
      "utf8"
    )

    expect(action).toContain('platformAccessLevel !== "developer"')
    expect(action).toContain('rpc("set_organization_coach_assignments"')
    expect(action).toContain('"assign_all_coaches_to_all_organizations"')
  })

  it("counts many-to-many coverage and assignments separately", () => {
    const assignments = [assignment(paula), assignment(joel)]
    const coverage = computeOrganizationCoachAssignmentCoverage([
      project({
        id: "canonical-1",
        name: "Organization One",
        organizationId: "org-1",
        projectKind: "organization_admin",
        organizationCoachAssignments: assignments,
      }),
      project({
        id: "standard-1",
        name: "Organization One project",
        organizationId: "org-1",
        projectKind: "standard",
        organizationCoachAssignments: assignments,
      }),
      project({
        id: "canonical-2",
        name: "Organization Two",
        organizationId: "org-2",
        projectKind: "organization_admin",
        organizationCoachAssignments: [],
      }),
    ])

    expect(coverage).toEqual({
      totalOrganizations: 2,
      coveredOrganizations: 1,
      unassignedOrganizations: 1,
      assignmentCount: 2,
      countByCoachId: { [paula.id]: 1, [joel.id]: 1 },
    })
  })

  it("filters related organization projects by coach or unassigned state", () => {
    const assignments = [assignment(paula), assignment(joel)]
    const projects = [
      project({
        id: "canonical-1",
        name: "Organization One",
        organizationId: "org-1",
        projectKind: "organization_admin",
        organizationCoachAssignments: assignments,
      }),
      project({
        id: "standard-1",
        name: "Organization One project",
        organizationId: "org-1",
        projectKind: "standard",
        organizationCoachAssignments: assignments,
      }),
      project({
        id: "canonical-2",
        name: "Organization Two",
        organizationId: "org-2",
        projectKind: "organization_admin",
        organizationCoachAssignments: [],
      }),
    ]

    expect(
      filterProjectsByOrganizationCoach({ projects, value: paula.id }).map(
        ({ id }) => id
      )
    ).toEqual(["canonical-1", "standard-1"])
    expect(
      filterProjectsByOrganizationCoach({ projects, value: joel.id }).map(
        ({ id }) => id
      )
    ).toEqual(["canonical-1", "standard-1"])
    expect(
      filterProjectsByOrganizationCoach({
        projects,
        value: "unassigned",
      }).map(({ id }) => id)
    ).toEqual(["canonical-2"])
  })

  it("normalizes and serializes stable coach filters", () => {
    expect(
      normalizeOrganizationCoachFilter({
        coachOptions: [paula],
        value: "removed-coach",
      })
    ).toBe("all")
    expect(
      normalizeOrganizationCoachFilter({
        coachOptions: [paula],
        value: paula.id,
      })
    ).toBe(paula.id)

    const params = new URLSearchParams("status=active")
    applyOrganizationCoachFilterToParams(params, "unassigned")
    expect(params.toString()).toBe("status=active&coach=unassigned")
    applyOrganizationCoachFilterToParams(params, "all")
    expect(params.toString()).toBe("status=active")
  })

  it("restricts active coach scope without reducing developer access", () => {
    const assignedScope = {
      mode: "assigned" as const,
      organizationIds: new Set(["org-1"]),
    }

    expect(canAccessOrganizationInCoachScope({ mode: "all" }, "org-2")).toBe(
      true
    )
    expect(canAccessOrganizationInCoachScope(assignedScope, "org-1")).toBe(true)
    expect(canAccessOrganizationInCoachScope(assignedScope, "org-2")).toBe(
      false
    )
    expect(
      filterByOrganizationCoachScope(
        [{ orgId: "org-1" }, { orgId: "org-2" }],
        assignedScope
      )
    ).toEqual([{ orgId: "org-1" }])
  })

  it("keeps assigned-only visibility behind an audited readiness gate", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260722141000_add_organization_coach_scoping.sql"
      ),
      "utf8"
    )

    expect(migration).toContain(
      "assigned_only_enabled boolean not null default false"
    )
    expect(migration).toContain("set_organization_coach_scope_enabled")
    expect(migration).toContain("Only developers can change coach visibility")
    expect(migration).toContain("organization_coach_scope_events")
    expect(migration).toContain("force row level security")
    expect(migration).toContain(
      "organization_coach_assignments_developer_delete"
    )
    expect(migration).toContain("protect_active_organization_coach_assignment")

    const manyToManyMigration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260722165900_many_to_many_organization_coach_assignments.sql"
      ),
      "utf8"
    )
    expect(manyToManyMigration).toContain(
      "primary key (organization_id, coach_user_id)"
    )
    expect(manyToManyMigration).toContain(
      "count(distinct organization_id)::integer"
    )
    expect(manyToManyMigration).toContain(
      "assign_all_coaches_to_all_organizations"
    )
    expect(manyToManyMigration).toContain(
      "Keep at least one coach assigned while assigned-only visibility is active."
    )
  })

  it("enforces coach scope in list, detail, mutation, and asset paths", () => {
    const projectLoader = readFileSync(
      resolve(
        process.cwd(),
        "src/features/member-workspace/server/project-loaders.ts"
      ),
      "utf8"
    )
    const detailLoader = readFileSync(
      resolve(
        process.cwd(),
        "src/features/member-workspace/server/project-detail-loader.ts"
      ),
      "utf8"
    )
    const projectActions = readFileSync(
      resolve(
        process.cwd(),
        "src/features/member-workspace/server/project-actions.ts"
      ),
      "utf8"
    )
    const projectAssetSupport = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/account/project-assets/route-support.ts"
      ),
      "utf8"
    )
    const projectsPage = readFileSync(
      resolve(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-projects-page.tsx"
      ),
      "utf8"
    )
    const projectsEmptyStates = readFileSync(
      resolve(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-projects-empty-states.tsx"
      ),
      "utf8"
    )
    const assetAuthorization = projectAssetSupport.slice(
      projectAssetSupport.indexOf("export async function canAccessProjectOrg")
    )

    expect(projectLoader).toContain("filterOrganizationsForActor(")
    expect(detailLoader).toContain("actorCanAccessOrganization(actor")
    expect(projectActions).toContain(
      "actorCanAccessOrganization(actor, existingProject.org_id)"
    )
    expect(projectAssetSupport).toContain(
      '.from("organization_coach_scope_settings")'
    )
    expect(projectAssetSupport).toContain('.eq("coach_user_id", userId)')
    expect(
      assetAuthorization.indexOf('.from("platform_staff_members")')
    ).toBeLessThan(assetAuthorization.indexOf("await isPlatformAdmin"))
    expect(projectsPage).toContain("MemberWorkspaceProjectsEmptyStates")
    expect(projectsEmptyStates).toContain('title="No assigned organizations"')
  })
})

describe("initial assigned organization view", () => {
  it.each(["Joel", "Paula", "Caleb", "fs"])("defaults %s to their own assignments", (name) => {
    expect(defaultOrganizationCoachFilter({ ...paula, name, email: `${name}@coachhousesolutions.org` })).toBe(paula.id)
  })
  it("leaves other accounts on all organizations", () => {
    expect(defaultOrganizationCoachFilter({ ...paula, name: "Other Person", email: "other@example.com" })).toBe("all")
  })
})
