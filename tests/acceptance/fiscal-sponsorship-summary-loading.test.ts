import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  events: vi.fn(),
  canManage: vi.fn(),
}))
vi.mock("@/features/fiscal-sponsorship/server/workflow-support", () => ({
  resolveProjectAndContext: mocks.context,
  canManageFiscalSponsorshipForOrganization: mocks.canManage,
  isMissingFiscalWorkflowTableError: (error: { code: string }) =>
    error.code === "42P01",
  buildWorkflowTableError: () => ({ error: "Workflow unavailable" }),
}))
vi.mock("@/features/fiscal-sponsorship/server/workflow-event-summary", () => ({
  loadFiscalWorkflowEvents: mocks.events,
  mapFiscalWorkflowEventSummary: vi.fn(),
}))

import { loadFiscalSponsorshipProjectWorkflowSummary } from "@/features/fiscal-sponsorship/server/workflow-summary"

type Result = { data: unknown; error: { code: string; message: string } | null }
const application = {
  id: "application",
  status: "draft",
  primary_email: "person@example.test",
}

function context(load: (table: string, kind?: string) => Promise<Result>) {
  const from = vi.fn((table: string) => {
    let kind: string | undefined
    const run = () => load(table, kind)
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(run),
      returns: vi.fn(run),
    }
    query.eq.mockImplementation((key: string, value: string) => {
      if (key === "kind") kind = value
      return query
    })
    return query
  })
  mocks.context.mockResolvedValue({
    supabase: { from },
    project: { id: "project", org_id: "organization" },
    profileAudience: { platformAccessLevel: "member" },
    user: { id: "viewer", email: "person@example.test" },
  })
  return from
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.events.mockResolvedValue({ data: [], error: null })
  mocks.canManage.mockResolvedValue(false)
})

describe("fiscal summary loading", () => {
  it("starts independent reads together after resolving the authorized application", async () => {
    let release = () => {}
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const started: string[] = []
    context(async (table, kind) => {
      if (table === "fiscal_sponsorship_applications")
        return { data: application, error: null }
      started.push(kind ?? table)
      await pending
      return { data: null, error: null }
    })
    const response = loadFiscalSponsorshipProjectWorkflowSummary("project")
    await vi.waitFor(() => expect(started).toHaveLength(5))
    expect(mocks.events).toHaveBeenCalledOnce()
    expect(mocks.canManage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "organization",
        projectId: "project",
        userId: "viewer",
      })
    )
    release()
    await expect(response).resolves.toMatchObject({
      applicationId: "application",
      canCompleteW9: true,
      requiredDocuments: [],
    })
  })

  it("does not query application data when project authorization fails", async () => {
    const from = context(async () => ({ data: application, error: null }))
    mocks.context.mockResolvedValueOnce({ error: "Not authorized" })
    await expect(
      loadFiscalSponsorshipProjectWorkflowSummary("project")
    ).resolves.toEqual({ error: "Not authorized" })
    expect(from).not.toHaveBeenCalled()
    expect(mocks.events).not.toHaveBeenCalled()
  })

  it("skips all detail reads when no application exists", async () => {
    const from = context(async () => ({ data: null, error: null }))
    await expect(
      loadFiscalSponsorshipProjectWorkflowSummary("project")
    ).resolves.toMatchObject({ applicationId: null, requiredDocuments: [] })
    expect(from).toHaveBeenCalledTimes(1)
    expect(mocks.events).not.toHaveBeenCalled()
    expect(mocks.canManage).not.toHaveBeenCalled()
  })

  it.each([false, true])(
    "preserves coach signing-link authorization: %s",
    async (allowed) => {
      mocks.canManage.mockResolvedValue(allowed)
      context(async (table) => ({
        data:
          table === "fiscal_sponsorship_applications"
            ? application
            : table === "fiscal_sponsorship_signature_packets"
              ? {
                  id: "packet",
                  provider: "native",
                  applicant_signer_id: "another-user",
                  status: "draft",
                }
              : null,
        error: null,
      }))
      await expect(
        loadFiscalSponsorshipProjectWorkflowSummary("project")
      ).resolves.toMatchObject({
        latestSignaturePacket: {
          applicantSigningHref: null,
          coachSigningHref: allowed ? "/fiscal-sponsorship/sign/packet" : null,
        },
      })
    }
  )

  it.each(["42P01", "other"])(
    "preserves ordered error handling for %s",
    async (code) => {
      context(async (table) =>
        table === "fiscal_sponsorship_applications"
          ? { data: application, error: null }
          : { data: null, error: { code, message: "failed" } }
      )
      await expect(
        loadFiscalSponsorshipProjectWorkflowSummary("project")
      ).resolves.toEqual({
        error:
          code === "42P01"
            ? "Workflow unavailable"
            : "Unable to load fiscal sponsorship agreement status.",
      })
    }
  )
})
