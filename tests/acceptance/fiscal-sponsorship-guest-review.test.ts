import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), auth: vi.fn(), draft: vi.fn(), workflow: vi.fn(), context: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/request-context", () => ({ resolveAuthenticatedAppContext: mocks.auth }))
vi.mock("@/features/fiscal-sponsorship/server/actions", () => ({ loadFiscalSponsorshipApplicationDraft: mocks.draft }))
vi.mock("@/features/fiscal-sponsorship/server/workflow-summary", () => ({ loadFiscalSponsorshipProjectWorkflowSummary: mocks.workflow }))
vi.mock("@/features/fiscal-sponsorship/server/workflow-support", () => ({ resolveProjectAndContext: mocks.context }))

import { loadGuestNotificationRecipients } from "@/features/fiscal-sponsorship/server/guest-notification-recipients"
import { loadGuestFiscalProjectReview } from "@/features/fiscal-sponsorship/server/guest-project-review"
import { loadW9Context } from "@/features/fiscal-sponsorship/server/w9-session-support"
import { generateFiscalSponsorshipAgreement, sendFiscalSponsorshipAgreementForSignature } from "@/features/fiscal-sponsorship/server/workflow-agreement-actions"

const id = "20000000-0000-4000-8000-000000000001"
const summary = { projectId: id, projectName: "Applicant project", accountLinked: false, emailVerified: false }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: "actual-reviewer" }, profileAudience: { isPlatformStaff: true }, supabase: { rpc: mocks.rpc } })
  mocks.rpc.mockResolvedValue({ data: summary, error: null })
  mocks.draft.mockResolvedValue({ ok: true, application: { primaryEmail: "guest@example.test" } })
  mocks.workflow.mockResolvedValue({ applicationStatus: "submitted" })
})

describe("guest project review", () => {
  it("binds the lookup to the signed-in actor and returns applicant data", async () => {
    expect(await loadGuestFiscalProjectReview(id)).toEqual({ ...summary, application: { primaryEmail: "guest@example.test" }, workflow: { applicationStatus: "submitted" }, emailDelivery: null })
    expect(mocks.rpc).toHaveBeenCalledWith("get_fiscal_guest_project_summary", { p_project_id: id, p_user_id: "actual-reviewer" })
  })
  it.each([
    { data: null, error: null },
    { data: summary, error: { message: "unavailable" } },
    { data: { ...summary, accountLinked: "yes" }, error: null },
  ])("does not load private application data after a failed access/summary lookup", async (result) => {
    mocks.rpc.mockResolvedValue(result)
    expect(await loadGuestFiscalProjectReview(id)).toBeNull()
    expect(mocks.draft).not.toHaveBeenCalled()
    expect(mocks.workflow).not.toHaveBeenCalled()
  })
  it("denies nonstaff before querying", async () => {
    mocks.auth.mockResolvedValue({ profileAudience: { isPlatformStaff: false } })
    expect(await loadGuestFiscalProjectReview(id)).toBeNull()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each(["draft", "workflow"] as const)("returns recovery copy when the %s query fails", async (query) => {
    mocks[query].mockResolvedValue({ error: "unavailable" })
    expect(await loadGuestFiscalProjectReview(id)).toEqual({ error: "The application could not be loaded. Refresh to try again." })
  })
  it("rejects malformed project ids", async () => {
    expect(await loadGuestFiscalProjectReview("bad-id")).toBeNull()
    expect(mocks.auth).not.toHaveBeenCalled()
  })
  it.each([true, false, undefined])("never prepares or sends agreements using the host identity for guest or indeterminate scope (%s)", async (scope) => {
    mocks.context.mockResolvedValue({ project: { id }, user: { id: "actual-reviewer" }, supabase: { rpc: mocks.rpc } })
    mocks.rpc.mockResolvedValue({ data: scope, error: null })
    expect(await loadW9Context(id)).toEqual({ error: "Guest tax-form signing is not available yet." })
    expect(await generateFiscalSponsorshipAgreement({ projectId: id })).toEqual({ error: "Guest agreement preparation and signing are not available yet." })
    expect(await sendFiscalSponsorshipAgreementForSignature({ projectId: id, documentId: "document" })).toEqual({ error: "Guest agreement preparation and signing are not available yet." })
  })
})


describe("guest notification recipient boundaries", () => {
  const client = { rpc: mocks.rpc } as unknown as Parameters<typeof loadGuestNotificationRecipients>[0]
  it("notifies assigned reviewers and excludes the actor", async () => {
    mocks.rpc.mockResolvedValue({ data: ["karissa", "joel"], error: null })
    expect(await loadGuestNotificationRecipients(client, id, "karissa")).toEqual(["joel"])
  })
  it("permits normal organization routing only for an ordinary project", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await loadGuestNotificationRecipients(client, id)).toBeNull()
  })
  it.each([
    { data: null, error: { code: "unavailable" } },
    { data: [123], error: null },
    { data: [], error: null },
  ])("does not fall back to host members on empty/failed guest lookups", async (result) => {
    mocks.rpc.mockResolvedValue(result)
    expect(await loadGuestNotificationRecipients(client, id)).toEqual([])
  })
})
