import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), accountRpc: vi.fn(), getUser: vi.fn(), activeOrg: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: mocks.accountRpc, auth: { getUser: mocks.getUser } }) }))
vi.mock("@/lib/organization/active-org-cookie", () => ({ writeActiveOrganizationCookie: mocks.activeOrg }))
import { handleGuestFiscalProfile } from "@/features/fiscal-sponsorship/server/guest-profile"
import { GUEST_COOKIE, issueGuestCapability } from "@/features/fiscal-sponsorship/server/guest-request-security"
import { guestProfileFieldsSchema, guestProfileHref } from "@/features/fiscal-sponsorship/lib/guest-profile"
const secret = "profile-test-secret-at-least-32-characters"
const reference = "20000000-0000-4000-8000-000000000001"
const actor = "30000000-0000-4000-8000-000000000001"
const fields = { name: "Garden", description: "Public benefit", email: "applicant@example.test", phone: "" }
const preview = { state: "preview", version: "a".repeat(32), isPublic: false, current: fields, suggestions: fields }
const request = (body: object = { operation: "preview", reference }, origin = "https://coach.test") => new Request("https://coach.test/api/public/fiscal-sponsorship/profile", {
  method: "POST", headers: { origin, "content-type": "application/json", cookie: `${GUEST_COOKIE}=${issueGuestCapability(secret)}` }, body: JSON.stringify(body),
})
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("FISCAL_GUEST_INTAKE_ENABLED", "true"); vi.stubEnv("FISCAL_GUEST_RISK_SECRET", secret)
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://coach.test"); vi.stubEnv("HCAPTCHA_SECRET_KEY", "test-secret")
  vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "test-site"); vi.stubEnv("VERCEL", "")
  vi.stubEnv("FISCAL_GUEST_PROFILE_IMPORT_ENABLED", "false")
  mocks.accountRpc.mockResolvedValue({ data: null, error: null })
  mocks.getUser.mockResolvedValue({ data: { user: { id: actor, email_confirmed_at: "2026-10-10T00:00:00Z" } }, error: null })
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : preview, error: null }))
})
afterEach(() => vi.unstubAllEnvs())
describe("optional verified fiscal profile reuse", () => {
  it("reopens a legacy own-organization claim without copying answers when its guest session is gone", async () => {
    vi.stubEnv("FISCAL_GUEST_PROFILE_IMPORT_ENABLED", "true")
    mocks.accountRpc.mockResolvedValue({ data: true, error: null })
    for (const operation of ["preview", "open"]) {
      const input = request({ operation, reference }); input.headers.delete("cookie")
      const response = await handleGuestFiscalProfile(input)
      expect(await response.json()).toEqual(operation === "open" ? { state: "opened", href: "/workspace?drawer=organization" } : { state: "linked" })
    }
    expect(mocks.activeOrg).toHaveBeenCalledOnce()
    expect(mocks.activeOrg).toHaveBeenCalledWith(actor)
    expect(mocks.rpc.mock.calls.every(([name]) => name === "consume_fiscal_guest_limit")).toBe(true)
  })
  it("does not open an editor's personal organization from another organization's application", async () => {
    vi.stubEnv("FISCAL_GUEST_PROFILE_IMPORT_ENABLED", "true")
    mocks.accountRpc.mockResolvedValue({ data: false, error: null })
    const input = request({ operation: "open", reference }); input.headers.delete("cookie")
    expect((await handleGuestFiscalProfile(input)).status).toBe(403)
    expect(mocks.accountRpc).toHaveBeenCalledWith("fiscal_profile_owner_linked", { p_reference: reference })
    expect(mocks.activeOrg).not.toHaveBeenCalled()
  })
  it("cannot create a claim or copy profile answers with only a signed-in account", async () => {
    vi.stubEnv("FISCAL_GUEST_PROFILE_IMPORT_ENABLED", "true")
    const input = request({ operation: "save", reference, requestId: actor, version: "a".repeat(32), fields: { name: "Unverified" } }); input.headers.delete("cookie")
    expect((await handleGuestFiscalProfile(input)).status).toBe(403)
    expect(mocks.activeOrg).not.toHaveBeenCalled()
    expect(mocks.rpc.mock.calls.every(([name]) => name === "consume_fiscal_guest_limit")).toBe(true)
  })
  it("loads only the allowlisted preview through server-verified identity", async () => {
    const response = await handleGuestFiscalProfile(request())
    expect(await response.json()).toEqual(preview)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(mocks.getUser).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenLastCalledWith("preview_fiscal_guest_profile", { p_reference: reference, p_key_hash: expect.stringMatching(/^[a-f0-9]{64}$/), p_user_id: actor })
  })
  it("requires sign-in without creating an account or org", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await handleGuestFiscalProfile(request())).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("rejects unconfirmed account email", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: actor } }, error: null })
    expect((await handleGuestFiscalProfile(request())).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("rejects missing proof browser and cross-origin requests before auth/database calls", async () => {
    const input = request(); input.headers.delete("cookie")
    expect((await handleGuestFiscalProfile(input)).status).toBe(403)
    expect((await handleGuestFiscalProfile(request(undefined, "https://evil.test"))).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.getUser).not.toHaveBeenCalled()
  })
  it("never accepts caller-controlled account, organization, status or publishing fields", async () => {
    for (const injection of [{ userId: actor }, { organizationId: actor }, { status: "approved" }]) {
      expect((await handleGuestFiscalProfile(request({ operation: "preview", reference, ...injection }))).status).toBe(400)
    }
    expect((await handleGuestFiscalProfile(request({ operation: "save", reference, requestId: actor, version: "a".repeat(32), fields: { is_public: true } }))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("preserves the explicit field selection and retry identifier", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : { state: "linked" }, error: null }))
    const payload = { operation: "save", reference, requestId: actor, version: "a".repeat(32), fields: { name: "Chosen name" } }
    expect(await (await handleGuestFiscalProfile(request(payload))).json()).toEqual({ state: "linked" })
    expect(mocks.rpc).toHaveBeenLastCalledWith("save_fiscal_guest_profile", expect.objectContaining({ p_user_id: actor, p_request_id: actor, p_fields: { name: "Chosen name" }, p_version: "a".repeat(32) }))
  })
  it("allows link-only with zero profile fields", () => {
    expect(guestProfileFieldsSchema.parse({})).toEqual({})
    expect(guestProfileFieldsSchema.safeParse({ description: "<script>alert(1)</script>" }).success).toBe(false)
    expect(guestProfileFieldsSchema.safeParse({ name: "" }).success).toBe(false)
    expect(guestProfileFieldsSchema.safeParse({ email: "invalid" }).success).toBe(false)
  })
  it("opens only the already-linked owner's profile after an explicit action", async () => {
    expect((await handleGuestFiscalProfile(request({ operation: "open", reference }))).status).toBe(403)
    expect(mocks.activeOrg).not.toHaveBeenCalled()
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : { state: "linked" }, error: null }))
    expect(await (await handleGuestFiscalProfile(request())).json()).toEqual({ state: "linked" })
    expect(mocks.activeOrg).not.toHaveBeenCalled()
    expect(await (await handleGuestFiscalProfile(request({ operation: "open", reference }))).json()).toEqual({ state: "opened", href: "/workspace?drawer=organization" })
    expect(mocks.activeOrg).toHaveBeenCalledWith(actor)
  })
  it("denies invalid, expired, mismatched or already claimed proof without revealing data", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : null, error: null }))
    const response = await handleGuestFiscalProfile(request())
    expect(response.status).toBe(403)
    expect(JSON.stringify(await response.json())).not.toContain("applicant@example.test")
  })
  it("does not overwrite a changed or newly published profile", async () => {
    for (const state of ["conflict", "public_profile"]) {
      mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : { state }, error: null }))
      expect((await handleGuestFiscalProfile(request({ operation: "save", reference, requestId: actor, version: "a".repeat(32), fields: {} }))).status).toBe(409)
    }
  })
  it("limits requests and fails closed on database errors", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    expect((await handleGuestFiscalProfile(request())).status).toBe(429)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private internal error" } })
    const response = await handleGuestFiscalProfile(request())
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain("private internal error")
  })
  it("leaves disabled environments closed and uses only a non-secret reference in auth return URLs", async () => {
    vi.stubEnv("FISCAL_GUEST_INTAKE_ENABLED", "false")
    expect((await handleGuestFiscalProfile(request())).status).toBe(503)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(guestProfileHref(reference)).toBe(`/documentation/fiscal-sponsorship/profile?application=${reference}`)
  })
})
