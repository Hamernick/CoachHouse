import { beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

const mocks = vi.hoisted(() => ({
  context: vi.fn(), from: vi.fn(), rpc: vi.fn(), create: vi.fn(), save: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/features/member-workspace", () => ({ createMemberWorkspaceProjectAction: mocks.create }))
vi.mock("@/lib/auth/request-context", () => ({ resolveAuthenticatedAppContext: mocks.context }))
vi.mock("@/features/fiscal-sponsorship/server/actions", () => ({ saveFiscalSponsorshipApplicationDraft: mocks.save }))

import {
  loadFiscalWorkspaceApplications, startFiscalWorkspaceApplication,
} from "@/features/fiscal-sponsorship/server/workspace-applications"
import {
  fiscalWorkspaceApplicationStatus, workspaceApplicationPrefill,
} from "@/features/fiscal-sponsorship/lib/workspace-applications"
import { FiscalSponsorshipWorkspaceCardSurface } from "@/features/fiscal-sponsorship/components/fiscal-sponsorship-workspace-card-surface"
import { buildSelectedProgramPrefill, buildWorkspaceApplicantPrefill } from "@/features/fiscal-sponsorship/lib/workspace-application-prefill"

const orgId = "00000000-0000-4000-8000-000000000001"
const projectId = "00000000-0000-4000-8000-000000000002"
const otherProjectId = "00000000-0000-4000-8000-000000000003"
const sourceId = "00000000-0000-4000-8000-000000000004"

function query(data: unknown, error: unknown = null) {
  const result = { data, error }
  const builder = {
    select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  for (const key of ["select", "eq", "in", "order"] as const) builder[key].mockReturnValue(builder)
  return builder
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.context.mockResolvedValue({
    supabase: { from: mocks.from, rpc: mocks.rpc }, user: { id: "user" },
    activeOrg: { orgId, role: "owner" }, profileAudience: { isPlatformStaff: false },
  })
  mocks.rpc.mockResolvedValue({ data: null, error: null })
  mocks.create.mockResolvedValue({ ok: true, id: projectId })
  mocks.save.mockResolvedValue({ ok: true, applicationId: "application", updatedAt: "2026-10-20" })
})

describe("workspace sponsorship application persistence", () => {
  it("starts an independent project and persists activity prefill as a draft, without submission", async () => {
    const result = await startFiscalWorkspaceApplication({
      orgId, name: "  Community garden  ", description: "Grow food together",
      prefill: { sourceActivityId: sourceId, sourceActivityTitle: "Community garden", focusArea: "Food access" },
    })
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith({
      orgId, name: "Community garden", description: "Grow food together",
      status: "planned", priority: "medium", fiscalSponsorshipEnabled: true,
    })
    expect(mocks.save).toHaveBeenCalledOnce()
    expect(mocks.save.mock.calls[0][0]).toMatchObject({
      projectId, status: "draft", projectName: "Community garden",
      projectDescription: "Grow food together", focusArea: "Food access",
      metadata: { selectedActivityId: sourceId },
    })
    expect(result).toMatchObject({
      application: { projectId, name: "Community garden", status: "draft", sourceActivityId: sourceId },
      warning: null,
    })
  })

  it("creates custom activities without requiring an existing activity source", async () => {
    const result = await startFiscalWorkspaceApplication({ orgId, name: "New program" })
    expect(result).toMatchObject({ application: { projectId, sourceActivityId: null } })
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ projectName: "New program", metadata: { selectedActivityId: null } })
  })

  it("gives different applications different project IDs", async () => {
    mocks.create.mockResolvedValueOnce({ ok: true, id: projectId })
      .mockResolvedValueOnce({ ok: true, id: otherProjectId })
    await startFiscalWorkspaceApplication({ orgId, name: "First" })
    await startFiscalWorkspaceApplication({ orgId, name: "Second" })
    expect(mocks.save.mock.calls.map(([input]) => input.projectId)).toEqual([projectId, otherProjectId])
  })

  it("refuses stale organization scope before creating anything", async () => {
    expect(await startFiscalWorkspaceApplication({ orgId: otherProjectId, name: "No" })).toHaveProperty("error")
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it("rejects viewers before creating anything", async () => {
    mocks.context.mockResolvedValue({
      activeOrg: { orgId, role: "member" }, profileAudience: { isPlatformStaff: false },
    })
    expect(await startFiscalWorkspaceApplication({ orgId, name: "No" })).toHaveProperty("error")
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it.each(["", " ".repeat(2), "x".repeat(161)])("rejects invalid names without writes", async (name) => {
    expect(await startFiscalWorkspaceApplication({ orgId, name })).toHaveProperty("error")
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it("preserves existing project creation access and entitlement errors", async () => {
    mocks.create.mockResolvedValue({ error: "Access denied" })
    expect(await startFiscalWorkspaceApplication({ orgId, name: "No" })).toEqual({ error: "Access denied" })
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it.each(["error", "exception"])("returns the created project after a draft save %s instead of duplicating it", async (failure) => {
    if (failure === "error") mocks.save.mockResolvedValue({ error: "Save unavailable" })
    else mocks.save.mockRejectedValue(new Error("Connection lost"))
    const result = await startFiscalWorkspaceApplication({ orgId, name: "Recoverable" })
    expect(result).toMatchObject({ application: { projectId, name: "Recoverable" }, warning: expect.any(String) })
    expect(mocks.create).toHaveBeenCalledOnce()
  })

  it("lists persisted drafts and legacy applications with their own status, excluding untouched shells and guest scope", async () => {
    const projects = query([
      { id: projectId, name: "New draft", description: null, project_kind: "standard", option_settings: { fiscalSponsorshipEnabled: true } },
      { id: otherProjectId, name: "Org workspace", project_kind: "organization_admin" },
      { id: "untouched", name: "Untouched", project_kind: "organization_admin" },
      { id: "guest", name: "Private intake", project_kind: "standard", option_settings: { fiscalSponsorshipEnabled: true } },
      { id: "ordinary", name: "No fiscal work", project_kind: "standard" },
    ])
    const applications = query([{ project_id: otherProjectId, project_name: "Legacy application", status: "in_review", metadata: { selectedActivityId: sourceId } }])
    mocks.from.mockImplementation((table) => table === "organization_projects" ? projects : applications)
    mocks.rpc.mockImplementation(async (_, { p_project_id: id }) => ({ data: id === "guest" ? true : null, error: null }))
    const result = await loadFiscalWorkspaceApplications()
    expect(projects.eq).toHaveBeenCalledWith("org_id", orgId)
    expect(projects.eq).toHaveBeenCalledWith("organization_unassigned", false)
    expect(applications.eq).toHaveBeenCalledWith("org_id", orgId)
    expect(applications.in).toHaveBeenCalledWith("project_id", [projectId, otherProjectId, "untouched"])
    expect(result).toMatchObject({ orgId, canCreate: true, applications: [
      { projectId, name: "New draft", status: null },
      { projectId: otherProjectId, name: "Legacy application", status: "in_review", sourceActivityId: sourceId },
    ] })
  })

  it("reports loading failures rather than presenting false empty states", async () => {
    mocks.from.mockReturnValue(query(null, { message: "unavailable" }))
    expect(await loadFiscalWorkspaceApplications()).toHaveProperty("error")
  })

  it("reports an access lookup failure instead of hiding all saved applications", async () => {
    mocks.from.mockReturnValue(query([
      { id: projectId, name: "Saved", project_kind: "standard", option_settings: { fiscalSponsorshipEnabled: true } },
    ]))
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } })
    expect(await loadFiscalWorkspaceApplications()).toEqual({ error: "Could not verify application access. Try again." })
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("organization_projects")
  })
})

describe("minimal sponsorship front door", () => {
  it("reuses organization identity without leaking another activity's dates or budget into a new application", () => {
    const base = buildWorkspaceApplicantPrefill({
      applicantFullName: "Applicant", primaryEmail: "applicant@example.org",
      projectName: "Unrelated activity", projectLocation: "Other city",
      sourceActivityId: "other", estimatedBudgetCents: 50000,
      temporaryEndDate: "2027-01-01", prospectiveFundingSources: "Other funding",
    })
    expect(base).toMatchObject({ applicantFullName: "Applicant", primaryEmail: "applicant@example.org" })
    expect(base).not.toHaveProperty("projectName")
    expect(base).not.toHaveProperty("sourceActivityId")
    expect(base).not.toHaveProperty("estimatedBudgetCents")
    expect(buildSelectedProgramPrefill({ basePrefill: base, program: { id: sourceId, title: "Selected" } }))
      .toMatchObject({ projectName: "Selected", estimatedBudgetCents: null, temporaryEndDate: null })
  })
  it("keeps selection and workflow steps off the empty front card", () => {
    const html = renderToStaticMarkup(createElement(FiscalSponsorshipWorkspaceCardSurface, { onStart: () => {} }))
    expect(html).toContain("Start application")
    expect(html).toContain("new or existing activity")
    expect(html).not.toContain("Activity source")
    expect(html).not.toContain('role="progressbar"')
    expect(html).not.toContain("Required documents")
  })

  it("renders independent status and accessible actions for each application", () => {
    const html = renderToStaticMarkup(createElement(FiscalSponsorshipWorkspaceCardSurface, {
      onOpenApplication: () => {},
      onOpenProgress: () => {},
      applications: [
        { projectId, name: "Garden", description: null, status: "draft", sourceActivityId: null },
        { projectId: otherProjectId, name: "Mentoring", description: null, status: "in_review", sourceActivityId: sourceId },
      ],
    }))
    expect(html).toContain('aria-label="Garden: Continue application"')
    expect(html).toContain('aria-label="Mentoring: View progress"')
    expect(html).toContain('aria-label="View progress for Garden"')
    expect(html).toContain("Draft")
    expect(html).toContain("In review")
    expect(html).not.toContain('role="progressbar"')
  })

  it.each(["submitted", "in_review", "approved", "agreement_ready", "signed", "countersigned", "declined"] as const)(
    "opens progress for %s instead of implying a new application", (status) => {
      expect(fiscalWorkspaceApplicationStatus(status).edit).toBe(false)
    }
  )

  it("uses the selected application's source and name when resuming", () => {
    expect(workspaceApplicationPrefill({
      projectId, name: "Saved name", description: "Saved description", status: "draft", sourceActivityId: sourceId,
    }, { projectName: "Another activity", sourceActivityId: "other", applicantFullName: "Applicant" })).toMatchObject({
      projectName: "Saved name", sourceActivityId: sourceId, applicantFullName: "Applicant",
    })
  })
})
