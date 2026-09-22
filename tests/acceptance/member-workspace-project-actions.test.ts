import "./test-utils"

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { resetTestMocks } from "./test-utils"

const {
  createSupabaseAdminClientMock,
  resolveMemberWorkspaceActorContextMock,
} = vi.hoisted(() => ({
  createSupabaseAdminClientMock: vi.fn(),
  resolveMemberWorkspaceActorContextMock: vi.fn(),
}))

vi.mock(
  "@/features/member-workspace/server/member-workspace-actor-context",
  () => ({
    resolveMemberWorkspaceActorContext: resolveMemberWorkspaceActorContextMock,
  })
)

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}))

import {
  createMemberWorkspaceProjectAction,
  deleteMemberWorkspaceProjectAction,
  updateMemberWorkspaceProjectAction,
} from "@/features/member-workspace/server/project-actions"
import { MEMBER_WORKSPACE_UPGRADE_MESSAGE } from "@/features/member-workspace/server/access"

describe("member workspace project actions", () => {
  beforeEach(() => {
    resetTestMocks()
    createSupabaseAdminClientMock.mockReset()
    resolveMemberWorkspaceActorContextMock.mockReset()
  })

  it("allows platform admins to create organization projects for a chosen organization", async () => {
    const organizationQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { user_id: "org-1" },
        error: null,
      }),
    }
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "organizations") return organizationQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    }
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, projectId: "project-new" },
      error: null,
    })
    createSupabaseAdminClientMock.mockReturnValue({ rpc })

    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase,
      userId: "platform-admin-1",
      isAdmin: true,
      activeOrg: { orgId: "org-1", role: "owner" },
      canEdit: true,
    })

    await expect(
      createMemberWorkspaceProjectAction({
        orgId: "org-1",
        name: "Internal admin project",
        status: "planned",
        priority: "medium",
        startDate: "2026-04-09",
        endDate: "2026-04-10",
      })
    ).resolves.toEqual({ ok: true, id: "project-new" })

    expect(organizationQuery.maybeSingle).toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith(
      "create_organization_project_transition",
      expect.objectContaining({
        p_actor_id: "platform-admin-1",
        p_org_id: "org-1",
        p_project: expect.objectContaining({
          name: "Internal admin project",
          project_kind: "standard",
        }),
      })
    )
  })

  it("allows platform admins to update existing organization projects", async () => {
    const existingProjectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "project-1",
          org_id: "org-2",
          updated_at: "2026-08-06T00:20:00.000Z",
        },
        error: null,
      }),
    }
    const supabase = {
      from: vi.fn((table: string) => {
        if (table !== "organization_projects") {
          throw new Error(`Unexpected table: ${table}`)
        }
        return existingProjectQuery
      }),
    }
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        projectId: "project-1",
        updatedAt: "2026-08-06T00:21:00.000Z",
      },
      error: null,
    })
    createSupabaseAdminClientMock.mockReturnValue({ rpc })

    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase,
      userId: "platform-admin-1",
      isAdmin: true,
      activeOrg: { orgId: "org-1", role: "owner" },
      canEdit: true,
    })

    await expect(
      updateMemberWorkspaceProjectAction("project-1", {
        name: "Updated org project",
        description: "Rich text stays here.",
        overviewDocumentHtml:
          "<h2>Saved overview</h2><p><strong>Rich</strong> text stays here.</p>",
        status: "active",
        priority: "high",
        startDate: "2026-04-09",
        endDate: "2026-04-10",
      })
    ).resolves.toEqual({ ok: true, id: "project-1" })

    expect(existingProjectQuery.maybeSingle).toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith(
      "update_organization_project_transition",
      expect.objectContaining({
        p_actor_id: "platform-admin-1",
        p_expected_org_id: "org-2",
        p_expected_updated_at: "2026-08-06T00:20:00.000Z",
        p_overview_document_html:
          "<h2>Saved overview</h2><p><strong>Rich</strong> text stays here.</p>",
        p_overview_document_text:
          "## Saved overview\n\n**Rich** text stays here.",
        p_project: expect.objectContaining({
          description: "Rich text stays here.",
          name: "Updated org project",
          priority: "high",
          status: "active",
        }),
      })
    )
  })

  it("rejects free users before creating organization projects", async () => {
    const supabase = {
      from: vi.fn(),
    }

    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase,
      userId: "free-user-1",
      isAdmin: false,
      activeOrg: { orgId: "org-1", role: "owner" },
      canEdit: true,
      hasMemberWorkspaceAccess: false,
    })

    await expect(
      createMemberWorkspaceProjectAction({
        orgId: "org-1",
        name: "Free project",
        status: "planned",
        priority: "medium",
        startDate: "2026-04-09",
        endDate: "2026-04-10",
      })
    ).resolves.toEqual({ error: MEMBER_WORKSPACE_UPGRADE_MESSAGE })

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("allows platform admins to delete standard organization projects", async () => {
    const existingProjectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "project-1",
          org_id: "org-2",
          project_kind: "standard",
          canonical_org_id: null,
          updated_at: "2026-08-06T00:31:00.000Z",
        },
        error: null,
      }),
    }
    const supabase = {
      from: vi.fn((table: string) => {
        if (table !== "organization_projects") {
          throw new Error(`Unexpected table: ${table}`)
        }

        return existingProjectQuery
      }),
    }
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, projectId: "project-1" },
      error: null,
    })
    createSupabaseAdminClientMock.mockReturnValue({ rpc })

    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase,
      userId: "platform-admin-1",
      isAdmin: true,
      activeOrg: { orgId: "org-1", role: "owner" },
      canEdit: true,
    })

    await expect(
      deleteMemberWorkspaceProjectAction("project-1")
    ).resolves.toEqual({ ok: true, id: "project-1" })

    expect(existingProjectQuery.maybeSingle).toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith("delete_organization_project_transition", {
      p_actor_id: "platform-admin-1",
      p_expected_org_id: "org-2",
      p_expected_updated_at: "2026-08-06T00:31:00.000Z",
      p_project_id: "project-1",
    })
  })

  it("rejects deletion of canonical admin organization rows", async () => {
    const existingProjectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "project-1",
          org_id: "org-2",
          project_kind: "organization_admin",
          canonical_org_id: "org-2",
        },
        error: null,
      }),
    }
    const supabase = {
      from: vi.fn((table: string) => {
        if (table !== "organization_projects") {
          throw new Error(`Unexpected table: ${table}`)
        }

        return existingProjectQuery
      }),
    }

    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase,
      userId: "platform-admin-1",
      isAdmin: true,
      activeOrg: { orgId: "org-1", role: "owner" },
      canEdit: true,
    })

    await expect(
      deleteMemberWorkspaceProjectAction("project-1")
    ).resolves.toEqual({
      error:
        "Canonical organization records cannot be deleted from this screen.",
    })

    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it("keeps platform admin organization lists create-enabled with standard rows included", () => {
    const loaderSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/server/project-loaders.ts"
      ),
      "utf8"
    )

    expect(loaderSource).toContain("loadAdminStandardOrganizationProjects")
    expect(loaderSource).toContain(
      "...standardProjects.map(mapOrganizationProjectToViewModel)"
    )
    expect(loaderSource).toContain("canCreateProjects: true")
  })

  it("preserves coach-managed canonical organization fields during profile sync", () => {
    const adminProjectsSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/server/admin-projects.ts"
      ),
      "utf8"
    )

    expect(adminProjectsSource).toContain(
      "function buildCanonicalAdminOrganizationProjectUpdate("
    )
    expect(adminProjectsSource).toContain("name: desired.name")
    expect(adminProjectsSource).not.toContain(
      "description: desired.description"
    )
    expect(adminProjectsSource).not.toContain("status: desired.status")
    expect(adminProjectsSource).not.toContain("priority: desired.priority")
    expect(adminProjectsSource).not.toContain("start_date: desired.start_date")
    expect(adminProjectsSource).not.toContain("end_date: desired.end_date")
    expect(adminProjectsSource).not.toContain(
      "duration_label: desired.duration_label"
    )
    expect(adminProjectsSource).not.toContain(
      "member_labels: desired.member_labels"
    )
    expect(adminProjectsSource).not.toContain("task_count: desired.task_count")
  })

  it("keeps rich overview documents in a dedicated table instead of overloading project description", () => {
    const projectActionsSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/server/project-actions.ts"
      ),
      "utf8"
    )
    const overviewDocumentsSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/server/project-overview-documents.ts"
      ),
      "utf8"
    )
    const migrationSource = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260610194000_add_organization_project_overview_documents.sql"
      ),
      "utf8"
    )

    expect(projectActionsSource).toContain(
      "transitionOrganizationProjectUpdate"
    )
    expect(projectActionsSource).toContain("hasOverviewDocumentHtml")
    expect(overviewDocumentsSource).toContain(
      'from("organization_project_overview_documents")'
    )
    expect(overviewDocumentsSource).toContain("sanitizeHtml")
    expect(overviewDocumentsSource).toContain("created_by: actorId")
    expect(overviewDocumentsSource).toContain(".update({")
    expect(overviewDocumentsSource).toContain(".insert({")
    expect(migrationSource).toContain(
      "create table if not exists public.organization_project_overview_documents"
    )
    expect(migrationSource).toContain("force row level security")
    expect(migrationSource).toContain(
      "organization_project_overview_documents_project_key"
    )
  })
})


describe("project option atomic save routing", () => {
  it("routes metadata through the atomic create wrapper", async () => {
    const { transitionOrganizationProjectCreation } = await import("@/features/member-workspace/server/project-transition-support")
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, projectId: "new-project" }, error: null })
    createSupabaseAdminClientMock.mockReturnValue({ rpc })
    const project = { name: "Project", option_settings: { tags: [], sprintTypes: [] } }
    await expect(transitionOrganizationProjectCreation({ actorId: "actor", orgId: "org", project, hasOverviewDocument: false, overviewDocumentHtml: null, overviewDocumentText: null })).resolves.toEqual({ ok: true, projectId: "new-project" })
    expect(rpc).toHaveBeenCalledWith("create_organization_project_with_options", expect.objectContaining({ p_project: project }))
  })
  it("reports missing metadata migration without silently dropping colors", async () => {
    const { transitionOrganizationProjectUpdate } = await import("@/features/member-workspace/server/project-transition-support")
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202" } })
    createSupabaseAdminClientMock.mockReturnValue({ rpc })
    const result = await transitionOrganizationProjectUpdate({ actorId: "actor", expectedOrgId: "org", expectedUpdatedAt: "stamp", projectId: "project", project: { option_settings: { tags: [], sprintTypes: [] } }, hasOverviewDocument: false, overviewDocumentHtml: null, overviewDocumentText: null })
    expect(rpc).toHaveBeenCalledWith("update_organization_project_with_options", expect.anything())
    expect(result).toEqual({ error: expect.stringContaining("migrations") })
  })
})
