import { readFileSync } from "node:fs"
import { join } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { MemberWorkspaceProjectActivityTimeline } from "@/features/member-workspace/components/projects/member-workspace-project-activity-timeline"
import { MemberWorkspaceProjectOrganizationCard } from "@/features/member-workspace/components/projects/member-workspace-project-organization-card"
import { getProjectDetailsById } from "@/features/platform-admin-dashboard/upstream/lib/data/project-details"
import type { MemberWorkspaceAdminOrganizationSummary } from "@/features/member-workspace/types"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260716203000_add_admin_organization_operations.sql"
  ),
  "utf8"
)

const hardeningMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260717143300_harden_admin_organization_operations.sql"
  ),
  "utf8"
)

const organizationSummary: MemberWorkspaceAdminOrganizationSummary = {
  orgId: "org-1",
  canonicalProjectId: "project-1",
  name: "Coach House",
  ownerName: "Alex Rivera",
  ownerAvatarUrl: null,
  publicSlug: "coach-house",
  organizationStatus: "approved",
  isPublic: true,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-02T00:00:00.000Z",
  acceleratorProgress: 64,
  setupProgress: 75,
  setupCompletedCount: 9,
  setupTotalCount: 12,
  missingSetupCount: 3,
  memberCount: 1,
  tags: [],
  members: [
    {
      userId: "user-1",
      name: "Alex Rivera",
      email: "alex@example.com",
      avatarUrl: null,
      headline: null,
      organizationRole: "owner",
      platformRole: "member",
      isOwner: true,
      profileCompletenessPercent: 50,
      profileCompletedCount: 2,
      profileTotalCount: 4,
      profileMissingFields: ["headline", "profile photo"],
    },
  ],
  setupItems: [
    { id: "website", label: "Add website", complete: false },
    { id: "w9", label: "Upload W-9", complete: false },
    {
      id: "funding-goal",
      label: "Set a program funding goal",
      complete: false,
    },
    { id: "name", label: "Add organization name", complete: true },
    { id: "tagline", label: "Add tagline", complete: true },
    { id: "mission", label: "Add mission statement", complete: true },
    { id: "need", label: "Describe the community need", complete: true },
    { id: "values", label: "Add organizational values", complete: true },
    { id: "city", label: "Add city", complete: true },
    { id: "state", label: "Add state", complete: true },
    { id: "logo", label: "Upload organization logo", complete: true },
    { id: "program", label: "Add a program", complete: true },
  ],
  programs: [
    {
      id: "program-1",
      title: "Neighborhood grants",
      statusLabel: "Active",
      startAt: "2026-07-01T00:00:00.000Z",
      endAt: "2026-07-31T00:00:00.000Z",
      isPublic: true,
    },
  ],
  profile: {},
}

describe("member workspace admin operations", () => {
  it("stores per-admin workstream categories and immutable system activity", () => {
    expect(migration).toContain(
      "create table if not exists public.platform_admin_workstream_categories"
    )
    expect(migration).toContain(
      "create table if not exists public.platform_admin_project_workstream_states"
    )
    expect(migration).toContain(
      "create table if not exists public.organization_project_activity_events"
    )
    expect(migration).toContain(
      "owner_id = (select auth.uid()) and (select public.is_admin())"
    )
    expect(migration).toContain(
      "revoke insert, update, delete on public.organization_project_activity_events"
    )
    expect(migration).toContain("record_organization_task_activity")
    expect(migration).toContain("record_organization_program_activity")
    expect(migration).toContain(
      "record_fiscal_sponsorship_application_activity"
    )
  })

  it("hardens admin-operation privileges and repairs canonical task counts", () => {
    expect(hardeningMigration).toContain("revoke all privileges")
    expect(hardeningMigration).toContain("from anon, authenticated")
    expect(hardeningMigration).toContain(
      "grant select, insert, update, delete\n  on table public.platform_admin_workstream_categories\n  to authenticated"
    )
    expect(hardeningMigration).toContain(
      "grant select, insert, update, delete\n  on table public.platform_admin_project_workstream_states\n  to authenticated"
    )
    expect(hardeningMigration).toContain(
      "grant select\n  on table public.organization_project_activity_events\n  to authenticated"
    )
    expect(hardeningMigration).not.toContain("to anon")
    expect(hardeningMigration).toContain(
      "platform_admin_project_workstream_states_project_idx"
    )
    expect(hardeningMigration).toContain(
      "organization_project_activity_events_actor_idx"
    )
    expect(hardeningMigration).toContain(
      "where project.project_kind = 'organization_admin'"
    )
    expect(hardeningMigration).toContain(
      "project.task_count is distinct from counts.task_count"
    )
  })

  it("provides real category management and removes the dead column menu", () => {
    const source = [
      "member-workspace-project-board-view.tsx",
      "member-workspace-project-board-category-controls.tsx",
    ]
      .map((fileName) =>
        readFileSync(
          join(
            process.cwd(),
            "src/features/member-workspace/components/projects",
            fileName
          ),
          "utf8"
        )
      )
      .join("\n")

    expect(source).toContain("Add category")
    expect(source).toContain("Save name")
    expect(source).toContain("Delete category")
    expect(source).toContain("Restore defaults")
    expect(source).toContain("Restore default categories?")
    expect(source).toContain("Hide category")
    expect(source).toContain("Hidden categories")
    expect(source).toContain("Show all categories")
    expect(source).toContain("hiddenWorkstreamCategoryKeys")
    expect(source).toContain("onHiddenWorkstreamCategoryKeysChange")
    expect(source).toContain(
      "Default categories can be renamed but cannot be deleted."
    )
    expect(source).toContain("Cannot be deleted")
    expect(source).toContain("updateProjectWorkstreamAction")
    expect(source).toContain("overflow-x-auto")
    expect(source).toContain("aria-label={`Manage ${category.name} category`}")
    expect(source).not.toContain("disabled={isPending || !canManageBoard}")

    const workstreamSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/server/admin-workstreams.ts"
      ),
      "utf8"
    )
    const categorySource = readFileSync(join(process.cwd(), "src/features/member-workspace/server/workstream-categories.ts"), "utf8")
    for (const category of ["Intake", "In progress", "Waiting", "Complete"]) {
      expect(categorySource).toContain(`name: "${category}"`)
    }
    expect(workstreamSource).toContain("DEFAULT_WORKSTREAM_CATEGORIES as DEFAULT_CATEGORIES")
    expect(workstreamSource).toContain("...category")
    expect(workstreamSource).toContain(".upsert(defaultPayload")
    expect(workstreamSource).toContain(
      "Default workstream categories cannot be deleted"
    )
    expect(workstreamSource).toContain('.select("id")')
    expect(workstreamSource).toContain("if (!deletedCategory)")

    const loaderSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/server/project-loaders.ts"
      ),
      "utf8"
    )
    expect(loaderSource).toContain("loadPlatformAdminWorkstreamConfiguration({")
    expect(loaderSource).toContain("workstreamConfiguration")
  })

  it("keeps operational project fields while synchronizing real readiness", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/server/admin-projects.ts"
      ),
      "utf8"
    )
    const updateStart = source.indexOf(
      "function buildCanonicalAdminOrganizationProjectUpdate"
    )
    const refreshStart = source.indexOf(
      "function canonicalAdminProjectNeedsRefresh"
    )
    const updateSource = source.slice(updateStart, refreshStart)

    expect(updateSource).toContain("progress: desired.progress")
    expect(updateSource).not.toContain("status: desired.status")
    expect(updateSource).not.toContain("task_count: desired.task_count")
    expect(updateSource).not.toContain("member_labels: desired.member_labels")
    expect(migration).toContain("set task_count = (")
  })

  it("renders organization and user completeness from real summary values", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectOrganizationCard, {
        organization: organizationSummary,
      })
    )

    expect(markup).toContain("Organization setup")
    expect(markup).toContain("75%")
    expect(markup).toContain("9 of 12 setup items complete")
    expect(markup).toContain('data-slot="hover-card-trigger"')
    expect(markup).toContain(
      'data-react-grab-owner-component="MemberWorkspaceProjectOrganizationCard"'
    )
    expect(markup).toContain(
      'aria-describedby="organization-setup-description-org-1"'
    )
    expect(markup).toContain("cursor-pointer")
    expect(markup).not.toContain("cursor-help")
    expect(markup).toContain(
      "Incomplete: Add website, Upload W-9, Set a program funding goal."
    )
    expect(markup).toContain("Complete: Add organization name")
    expect(markup).toContain("User completeness")
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain(
      'data-react-grab-owner-slot="user-completeness-trigger"'
    )
    expect(markup).toContain('data-slot="hover-card-trigger"')
    expect(markup).toContain(
      'data-react-grab-surface-slot="user-completeness-details"'
    )
    expect(markup).toContain(
      'data-react-grab-owner-slot="user-completeness-member"'
    )
    expect(markup).toContain("Missing headline, profile photo")
  })

  it.each(["unavailable", "error", "forbidden"] as const)(
    "does not present %s activity as an empty history",
    (activityState) => {
      const markup = renderToStaticMarkup(
        React.createElement(MemberWorkspaceProjectActivityTimeline, {
          organizationSummary,
          project: {
            ...getProjectDetailsById("project-1"),
            activity: [],
            activityState,
          },
        })
      )
      expect(markup).not.toContain("No activity recorded yet.")
      expect(markup).toContain('role="status"')
      expect(markup).toContain("Refresh activity")
    }
  )

  it("renders program duration and recorded step transitions", () => {
    const project = {
      ...getProjectDetailsById("project-1"),
      activity: [
        {
          id: "event-1",
          entityType: "task" as const,
          eventType: "completed",
          title: "Review application",
          fromStatus: "in-progress",
          toStatus: "done",
          occurredAt: new Date("2026-07-16T15:00:00.000Z"),
          durationLabel: "2 days",
        },
      ],
    }
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectActivityTimeline, {
        organizationSummary,
        project,
      })
    )

    expect(markup).toContain("Program timelines")
    expect(markup).toContain("Neighborhood grants")
    expect(markup).toContain("31 days scheduled")
    expect(markup).toContain("Review application")
    expect(markup).toContain("In Progress to Done")
    expect(markup).toContain("2 days in the prior step")
  })
})
