import "./test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { context, cookie } = vi.hoisted(() => ({ context: vi.fn(), cookie: vi.fn() }))
vi.mock("@/lib/auth/request-context", () => ({ resolveOptionalAuthenticatedAppContext: context }))
vi.mock("@/lib/organization/active-org-cookie", () => ({ writeActiveOrganizationCookie: cookie }))
import { loadPublicFiscalApplicant, startPublicFiscalIntake } from "@/features/fiscal-sponsorship/server/public-intake"

function fixture() {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }
  const rpc = vi.fn().mockResolvedValue({ data: "own-project", error: null })
  const from = vi.fn().mockReturnValue(query)
  context.mockResolvedValue({ user: { id: "owner", email: "owner@example.org" }, activeOrg: { orgId: "joined-org", role: "board" }, supabase: { from, rpc } })
  return { query, from, rpc }
}

describe("public fiscal intake", () => {
  beforeEach(() => { context.mockReset(); cookie.mockReset() })
  it("denies anonymous starts and keeps the public page readable", async () => {
    context.mockResolvedValue(null)
    expect(await loadPublicFiscalApplicant()).toEqual({ authenticated: false })
    expect(await startPublicFiscalIntake("My organization")).toEqual({ error: "Sign in to start your application." })
    expect(cookie).not.toHaveBeenCalled()
  })
  it("only reads on page load, without changing active organization", async () => {
    const { query, rpc } = fixture()
    query.maybeSingle.mockResolvedValue({ data: { profile: { name: "Own organization" } }, error: null })
    expect(await loadPublicFiscalApplicant()).toEqual({ authenticated: true, organizationName: "Own organization" })
    expect(query.eq).toHaveBeenCalledWith("user_id", "owner")
    expect(rpc).not.toHaveBeenCalled()
    expect(cookie).not.toHaveBeenCalled()
  })
  it("rejects invalid names before invoking the database", async () => {
    const { rpc } = fixture()
    for (const name of ["  ", "x".repeat(161), null]) {
      expect(await startPublicFiscalIntake(name as string)).toHaveProperty("error")
    }
    expect(rpc).not.toHaveBeenCalled()
  })
  it("uses the authenticated RPC and owner scope, ignoring a joined active org", async () => {
    const { rpc, query } = fixture()
    const result = await startPublicFiscalIntake(" My organization ")
    expect(rpc).toHaveBeenCalledWith("start_public_fiscal_intake", { p_organization_name: "My organization" })
    expect(query.eq).toHaveBeenCalledWith("org_id", "owner")
    expect(cookie).toHaveBeenCalledWith("owner")
    expect(result).toMatchObject({ status: null, data: { projectId: "own-project", canApproveApplication: false, canGenerateAgreement: false, canSendAgreement: false } })
  })
  it("preserves the submitted status so the UI cannot open an editable draft", async () => {
    const { query } = fixture()
    query.maybeSingle.mockResolvedValue({ data: { id: "application", status: "submitted" }, error: null })
    expect(await startPublicFiscalIntake("My organization")).toMatchObject({ status: "submitted", data: { workflowSummary: { applicationId: "application", applicationStatus: "submitted" } } })
  })
  it("does not change context when initialization or application loading fails", async () => {
    const { rpc, query } = fixture()
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } })
    expect(await startPublicFiscalIntake("My organization")).toHaveProperty("error")
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "failed" } })
    expect(await startPublicFiscalIntake("My organization")).toHaveProperty("error")
    expect(cookie).not.toHaveBeenCalled()
  })
})
