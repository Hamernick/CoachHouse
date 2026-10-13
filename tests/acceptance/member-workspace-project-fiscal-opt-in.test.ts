import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mergeProjectOptions, projectFiscalSponsorshipEnabled, hasFiscalSponsorshipWork } from "@/features/member-workspace/lib/project-fiscal-sponsorship"
import { mapOrganizationProjectToViewModel } from "@/features/member-workspace/server/project-starter-data"
import { ProjectDetailTabsList } from "@/features/member-workspace/components/projects/project-detail-tabs-list"
import { Tabs } from "@/features/platform-admin-dashboard/upstream/components/ui/tabs"

const mocks = vi.hoisted(() => ({ actor: vi.fn(), admin: vi.fn() }))
vi.mock("@/features/member-workspace/server/member-workspace-actor-context", () => ({ resolveMemberWorkspaceActorContext: mocks.actor }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
import { updateMemberWorkspaceProjectAction } from "@/features/member-workspace/server/project-actions"
import { enableProjectFiscalSponsorshipAction } from "@/features/member-workspace/server/project-fiscal-sponsorship-actions"

const projectId = "00000000-0000-4000-8000-000000000001"
const existing = { id: projectId, org_id: "org-a", updated_at: "2026-10-03T12:00:00Z", option_settings: { tags: [{ id: "tag", label: "Tag" }], sprintTypes: [], untouched: "keep" }, guided_setup: null }
let read: ReturnType<typeof query>
let write: ReturnType<typeof query>
function query(data: unknown) {
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }) }
}
beforeEach(() => {
  vi.clearAllMocks()
  read = query(existing)
  write = query({ id: projectId })
  mocks.actor.mockResolvedValue({ userId: "editor", activeOrg: { orgId: "org-a" }, isAdmin: false, canEdit: true, hasMemberWorkspaceAccess: true, supabase: { from: () => read } })
  mocks.admin.mockReturnValue({ from: () => write })
})

describe("project fiscal sponsorship opt-in", () => {
  it("defaults off and projects both setup paths from saved data", () => {
    expect(projectFiscalSponsorshipEnabled()).toBe(false)
    for (const row of [{ option_settings: { fiscalSponsorshipEnabled: true } }, { guided_setup: { fiscalSponsorshipEnabled: true } }]) {
      const projected = mapOrganizationProjectToViewModel({
        ...row, id: projectId, org_id: "org-a", canonical_org_id: null,
        project_kind: "standard", name: "Project", description: null,
        status: "planned", priority: "medium", progress: 0,
        start_date: null, end_date: null, client_name: null,
        type_label: null, duration_label: null, tags: [], member_labels: [],
        task_count: 0, created_source: "user", starter_seed_key: null,
        starter_seed_version: null, created_by: "editor", updated_by: "editor",
        created_at: existing.updated_at, updated_at: existing.updated_at,
      })
      expect(projected.fiscalSponsorshipEnabled).toBe(true)
    }
  })
  it("preserves enablement and unrelated settings during ordinary edits", () => {
    expect(mergeProjectOptions({ ...existing.option_settings, fiscalSponsorshipEnabled: true }, { tags: [], sprintTypes: [] }, false))
      .toEqual({ tags: [], sprintTypes: [], untouched: "keep", fiscalSponsorshipEnabled: true })
  })
  it("keeps existing sponsorship work visible", () => {
    expect(hasFiscalSponsorshipWork(null)).toBe(false)
    const empty = { applicationId: null, applicationStatus: null, events: [], requiredDocuments: [] }
    expect(hasFiscalSponsorshipWork(empty as never)).toBe(false)
    expect(hasFiscalSponsorshipWork({ ...empty, applicationId: "application" } as never)).toBe(true)
    expect(hasFiscalSponsorshipWork({ ...empty, requiredDocuments: [{}] } as never)).toBe(true)
  })
  it("hides the default tab, shows the editor menu and retains the enabled tab", () => {
    const render = (enabled: boolean, canAdd: boolean) => renderToStaticMarkup(React.createElement(Tabs, { value: "overview" }, React.createElement(ProjectDetailTabsList, { fiscalEnabled: enabled, canAdd, adding: false, onAddFiscal: () => {} })))
    expect(render(false, true)).not.toContain('>Fiscal Sponsorship</button>')
    expect(render(false, true)).toContain('aria-label="Add project tab"')
    expect(render(true, true)).toContain('>Fiscal Sponsorship</button>')
    expect(render(false, false)).not.toContain('aria-label="Add project tab"')
  })
  it("saves only the project setting with ownership and version checks", async () => {
    expect(await enableProjectFiscalSponsorshipAction(projectId)).toEqual({ ok: true })
    expect(write.update).toHaveBeenCalledWith({ option_settings: { ...existing.option_settings, fiscalSponsorshipEnabled: true }, updated_by: "editor" })
    expect(write.eq).toHaveBeenCalledWith("id", projectId)
    expect(write.eq).toHaveBeenCalledWith("org_id", "org-a")
    expect(write.eq).toHaveBeenCalledWith("updated_at", existing.updated_at)
  })
  it("preserves a saved opt-in through the normal project edit action", async () => {
    read.maybeSingle.mockResolvedValue({ data: { ...existing, option_settings: { ...existing.option_settings, fiscalSponsorshipEnabled: true } }, error: null })
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, projectId, updatedAt: existing.updated_at }, error: null })
    mocks.admin.mockReturnValue({ rpc })
    expect(await updateMemberWorkspaceProjectAction(projectId, { name: "Updated", status: "planned", priority: "medium", optionSettings: { tags: [], sprintTypes: [] } })).toEqual({ ok: true, id: projectId })
    expect(rpc).toHaveBeenCalledWith("update_organization_project_with_options", expect.objectContaining({ p_project: expect.objectContaining({ option_settings: { tags: [], sprintTypes: [], untouched: "keep", fiscalSponsorshipEnabled: true } }) }))
  })
  it("is idempotent for an already enabled guided project", async () => {
    read.maybeSingle.mockResolvedValue({ data: { ...existing, guided_setup: { fiscalSponsorshipEnabled: true } }, error: null })
    expect(await enableProjectFiscalSponsorshipAction(projectId)).toEqual({ ok: true })
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("rejects viewers and foreign organization editors before admin writes", async () => {
    const actor = await mocks.actor()
    for (const change of [{ canEdit: false }, { activeOrg: { orgId: "org-b" } }]) {
      mocks.actor.mockResolvedValue({ ...actor, ...change })
      expect(await enableProjectFiscalSponsorshipAction(projectId)).toHaveProperty("error")
    }
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("rejects a coach outside the assigned organization scope", async () => {
    const actor = await mocks.actor()
    mocks.actor.mockResolvedValue({ ...actor, canAccessOrganizations: true, organizationCoachScope: { mode: "assigned", organizationIds: new Set(), canAccessUnassigned: false } })
    expect(await enableProjectFiscalSponsorshipAction(projectId)).toHaveProperty("error")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("reports concurrent updates and failed writes without claiming enablement", async () => {
    write.maybeSingle.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: { message: "failed" } })
    expect(await enableProjectFiscalSponsorshipAction(projectId)).toEqual({ error: expect.stringContaining("changed") })
    expect(await enableProjectFiscalSponsorshipAction(projectId)).toEqual({ error: expect.stringContaining("Could not add") })
  })
})

// These fixtures represent ordinary projects; guest scope has a separate denial suite.
vi.mock("@/lib/workspace/ordinary-project-access", () => ({ isOrdinaryWorkspaceProject: async () => true }))
