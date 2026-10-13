import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), fetch: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
import { handleGuestFiscalSession, handleGuestFiscalSubmission } from "@/features/fiscal-sponsorship/server/guest-submission"
import { GUEST_COOKIE, issueGuestCapability, readGuestCapability, verifyGuestCaptcha, guestIntakeConfiguration } from "@/features/fiscal-sponsorship/server/guest-request-security"
import { guestApplicationPayload, guestSubmissionSchema } from "@/features/fiscal-sponsorship/lib/guest-submission-schema"
import { guestSubmissionInput, guestFieldName } from "@/features/fiscal-sponsorship/lib/guest-submission-input"
import { buildFiscalSponsorshipApplicationDraft } from "@/features/fiscal-sponsorship/lib/application-draft"

const secret = "test-secret-at-least-thirty-two-characters"
const reference = "20000000-0000-4000-8000-000000000001"
function application() { return {
  applicantFirstName: "Test", applicantLastName: "Applicant", primaryEmail: "Guest@Example.test",
  mailingStreetAddress: "1 Test Street", mailingCity: "Chicago", mailingState: "IL", mailingPostalCode: "60601",
  legalEntityType: "individual", legalEntityHas501c3: false, projectName: "Garden",
  projectDescription: "Grow food", projectDurationType: "ongoing_multi_year",
  publicBenefit: "Food for neighbors", prospectiveFundingSources: "Donations",
  fundraisingGoal: { amountCents: 100000, period: "total" }, operatesOutsideUnitedStates: false,
  engagesInLobbying: false, hasLegalComplianceFinancialConcerns: false,
} }
function request(options: { body?: unknown; origin?: string; cookie?: string } = {}) {
 return new Request("https://coach.test/api/public/fiscal-sponsorship/applications", {
  method: "POST", headers: { origin: options.origin ?? "https://coach.test", "content-type": "application/json", cookie: `${GUEST_COOKIE}=${options.cookie ?? issueGuestCapability(secret)}` },
  body: JSON.stringify(options.body ?? { captchaToken: "valid-token", application: application() }),
 })
}
beforeEach(() => {
 vi.resetAllMocks()
 vi.stubEnv("FISCAL_GUEST_INTAKE_ENABLED", "true")
 vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://coach.test")
 vi.stubEnv("FISCAL_GUEST_RISK_SECRET", secret)
 vi.stubEnv("HCAPTCHA_SECRET_KEY", "test-captcha-secret")
 vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "test-site-key")
 vi.stubEnv("VERCEL", "")
 vi.stubGlobal("fetch", mocks.fetch)
 mocks.fetch.mockImplementation(async () => Response.json({ success: true }))
 mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "get_fiscal_guest_receipt" ? null : name === "submit_guest_fiscal_application" ? { submissionId: reference, projectId: "private-project", applicationId: "private-application" } : true, error: null }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe("guest fiscal submission boundary", () => {
 it("maps the shared editor to a minimal guest payload without internal fields", () => {
  const draft = buildFiscalSponsorshipApplicationDraft({ data: { projectId: "private", projectName: "Garden", applicantName: "" } })
  Object.assign(draft, application(), { fundraisingGoalDollars: "$1,000.50", fundraisingGoalPeriod: "monthly", legalEntityHas501c3: "no", operatesOutsideUnitedStates: "no", engagesInLobbying: "no", hasLegalComplianceFinancialConcerns: "no" })
  const parsed = guestSubmissionInput(draft,"captcha")
  expect(parsed.success).toBe(true)
  if (!parsed.success) return
  expect(parsed.data.application).not.toHaveProperty("projectId")
  expect(parsed.data.application).not.toHaveProperty("budgetRows")
  const stored = guestApplicationPayload({ ...parsed.data.application, mailingStreetAddress2: "Suite 2" })
  expect(stored).toHaveProperty("mailing_street_address_2", "Suite 2")
  expect(stored).not.toHaveProperty("mailing_street_address2")
  expect(parsed.data.application.fundraisingGoal).toEqual({ amountCents: 100050, period: "monthly" })
  expect(parsed.data.application.legalEntityHas501c3).toBeNull()
 })
 it("accepts the shared editor's explicit no-proposed-end-date choice", () => {
  const input = { captchaToken:"token", application: { ...application(), projectDurationType:"temporary", temporaryStartDate:"2026-10-10", temporaryEndDate:null } }
  expect(guestSubmissionSchema.safeParse(input).success).toBe(true)
  expect(guestSubmissionSchema.safeParse({ ...input, application:{ ...input.application, temporaryEndDate:"2026-10-09" } }).success).toBe(false)
  expect(guestFieldName(["application","fundraisingGoal","amountCents"])).toBe("fundraisingGoalDollars")
 })
 it("submits without an account and returns only the receipt reference", async () => {
  const result = await handleGuestFiscalSubmission(request())
  expect(result.status).toBe(201)
  expect(await result.json()).toEqual({ ok: true, reference })
  expect(result.headers.get("cache-control")).toBe("no-store")
  const call = mocks.rpc.mock.calls.find(([name]) => name === "submit_guest_fiscal_application")!
  expect(call[1].p_submission_key_hash).toMatch(/^[a-f0-9]{64}$/)
  expect(call[1].p_application.primary_email).toBe("guest@example.test")
  expect(call[1].p_application.legal_entity_has_501c3).toBe(false)
  expect(call[1].p_application.fundraising_goal).toEqual({ amountCents: 100000, period: "total" })
  expect(call[1].p_application).not.toHaveProperty("status")
 })
 it("reuses a committed receipt without re-verifying a spent captcha or creating another project", async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "get_fiscal_guest_receipt" ? { submissionId: reference } : true, error: null }))
  expect((await handleGuestFiscalSubmission(request())).status).toBe(200)
  expect(mocks.fetch).not.toHaveBeenCalled()
  expect(mocks.rpc.mock.calls.some(([name]) => name === "submit_guest_fiscal_application")).toBe(false)
 })
 it("stays disabled without explicit activation", async () => {
  vi.stubEnv("FISCAL_GUEST_INTAKE_ENABLED", "false")
  expect((await handleGuestFiscalSubmission(request())).status).toBe(503)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it("rejects cross-origin submissions before accessing records", async () => {
  expect((await handleGuestFiscalSubmission(request({ origin: "https://evil.test" }))).status).toBe(403)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it("does not trust caller ownership, status, metadata or unknown fields", async () => {
  for (const field of ["orgId", "projectId", "status", "metadata", "sourceSnapshot"]) {
   expect((await handleGuestFiscalSubmission(request({ body: { captchaToken: "token", application: { ...application(), [field]: "forged" } } }))).status).toBe(400)
  }
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it("rejects forged and expired session capabilities", async () => {
  const capability = issueGuestCapability(secret)
  expect((await handleGuestFiscalSubmission(request({ cookie: capability.slice(0, -1) + (capability.endsWith("a") ? "b" : "a") }))).status).toBe(401)
  vi.useFakeTimers(); vi.setSystemTime(Date.now() + 8 * 86400000)
  expect((await handleGuestFiscalSubmission(request({ cookie: capability }))).status).toBe(401)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it("bounds streamed bodies without trusting content-length", async () => {
  expect((await handleGuestFiscalSubmission(request({ body: { large: "x".repeat(65537) } }))).status).toBe(400)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it("allows lobbying/outside-US answers with explanation and rejects them without it", async () => {
  const input = { captchaToken: "token", application: { ...application(), engagesInLobbying: true, operatesOutsideUnitedStates: true } }
  expect(guestSubmissionSchema.safeParse(input).success).toBe(false)
  const parsed = guestSubmissionSchema.parse({ ...input, application: { ...input.application, concernsExplanation: "Advocacy work and programs abroad for review." } })
  expect(guestApplicationPayload(parsed.application)).toMatchObject({ engages_in_lobbying: true, operates_outside_united_states: true })
 })
 it("enforces shared durable limits before captcha and submission", async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null })
  const result = await handleGuestFiscalSubmission(request())
  expect(result.status).toBe(429)
  expect(result.headers.get("retry-after")).toBe("900")
  expect(mocks.fetch).not.toHaveBeenCalled()
 })
 it.each([false, "true"])("does not accept failed/malformed captcha success %s", async (success) => {
  mocks.fetch.mockResolvedValue(Response.json({ success }))
  expect((await handleGuestFiscalSubmission(request())).status).toBe(400)
  expect(mocks.rpc.mock.calls.some(([name]) => name === "submit_guest_fiscal_application")).toBe(false)
 })
 it("uses form encoding and verifies the configured sitekey", async () => {
  expect(await verifyGuestCaptcha(guestIntakeConfiguration()!, "token+data", "127.0.0.1")).toBe(true)
  const [url, init] = mocks.fetch.mock.calls[0]
  expect(url).toBe("https://api.hcaptcha.com/siteverify")
  expect(init.body.get("sitekey")).toBe("test-site-key")
  expect(init.body.get("response")).toBe("token+data")
 })
 it("rejects provider errors without exposing secrets", async () => {
  mocks.fetch.mockRejectedValue(new Error("sensitive provider detail"))
  const result = await handleGuestFiscalSubmission(request())
  expect(result.status).toBe(400)
  expect(await result.text()).not.toContain("sensitive")
 })
 it("does not falsely claim a failed acknowledgement means no submission occurred", async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "get_fiscal_guest_receipt" ? null : true, error: name === "submit_guest_fiscal_application" ? { message: "network timeout" } : null }))
  const result = await handleGuestFiscalSubmission(request())
  expect(result.status).toBe(503)
  expect(await result.text()).toContain("couldn’t confirm")
 })
 it("issues an HttpOnly same-site cookie without exposing it in JSON", async () => {
  const result = await handleGuestFiscalSession(request({ cookie: "invalid" }))
  expect(await result.json()).toEqual({ ok: true })
  const cookie = result.headers.get("set-cookie")!
  expect(cookie).toContain("HttpOnly")
  expect(cookie).toContain("SameSite=strict")
  expect(readGuestCapability(new Request("https://coach.test", { headers: { cookie: cookie.split(";")[0] } }), secret)).not.toBeNull()
 })
 it("blocks production dummy captcha keys and untrusted IP headers", () => {
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("HCAPTCHA_SECRET_KEY", "0x0000000000000000000000000000000000000000")
  expect(guestIntakeConfiguration()).toBeNull()
 })
})
