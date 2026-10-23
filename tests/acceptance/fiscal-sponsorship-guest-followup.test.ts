import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), accountRpc: vi.fn(), getUser: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: mocks.accountRpc, auth: { getUser: mocks.getUser } }) }))
import { loadLinkedFiscalApplications } from "@/features/fiscal-sponsorship/server/linked-applications"
import { handleGuestFiscalFollowup } from "@/features/fiscal-sponsorship/server/guest-followup"
import { GUEST_COOKIE, issueGuestCapability } from "@/features/fiscal-sponsorship/server/guest-request-security"
import { guestApplicationPayload } from "@/features/fiscal-sponsorship/lib/guest-submission-schema"
import { guestCorrectionDraft, parseGuestFollowup } from "@/features/fiscal-sponsorship/lib/guest-followup"
import { guestSubmissionInput } from "@/features/fiscal-sponsorship/lib/guest-submission-input"
import { filterPrivateTelemetry } from "@/lib/telemetry-privacy"
const secret = "test-followup-".repeat(4)
const reference = "20000000-0000-4000-8000-000000000001"
const answers = {
 applicantFirstName: "Sam", applicantLastName: "River", primaryEmail: "sam@example.test", mailingStreetAddress: "1 Main St", mailingStreetAddress2: "",
 mailingCity: "Chicago", mailingState: "IL", mailingPostalCode: "60601", phoneNumber: "", legalEntityType: "individual" as const,
 legalEntityHas501c3: null, formationStatus: "", projectName: "Garden", projectDescription: "Grow food", projectLocation: "Chicago",
 projectDurationType: "ongoing_multi_year" as const, temporaryStartDate: null, temporaryEndDate: null, focusArea: "",
 fundraisingGoal: { amountCents: 12345, period: "monthly" as const }, expenseSummary: "", prospectiveFundingSources: "Donors",
 publicBenefit: "Feed neighbors", leadershipBackground: "", initiativeHistory: "", operatesOutsideUnitedStates: false,
 engagesInLobbying: true, hasLegalComplianceFinancialConcerns: false, concernsExplanation: "Community advocacy",
}
const state = { reference, projectName: "Garden", status: "needs_info", version: "a".repeat(32), reviewNote: "Explain funding.", application: guestApplicationPayload(answers) }
const request = (body: object = { operation: "read", reference }, origin = "https://coach.test") => new Request("https://coach.test/api/public/fiscal-sponsorship/application", {
 method: "POST", headers: { origin, "content-type": "application/json", cookie: `${GUEST_COOKIE}=${issueGuestCapability(secret)}` }, body: JSON.stringify(body),
})
beforeEach(() => {
 vi.resetAllMocks(); vi.stubEnv("FISCAL_GUEST_INTAKE_ENABLED", "true"); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://coach.test")
 vi.stubEnv("FISCAL_GUEST_RISK_SECRET", secret); vi.stubEnv("HCAPTCHA_SECRET_KEY", "test-secret"); vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "test-key")
 vi.stubEnv("FISCAL_GUEST_PROFILE_IMPORT_ENABLED", "false")
 mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
 mocks.accountRpc.mockResolvedValue({ data: null, error: null })
 mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : name === "read_fiscal_guest_application" ? state : { state: "submitted" }, error: null }))
})
afterEach(() => vi.unstubAllEnvs())
describe("guest applicant follow-up", () => {
 it("lets a linked verified account read and correct after the guest cookie expires", async () => {
  vi.stubEnv("FISCAL_GUEST_PROFILE_IMPORT_ENABLED", "true")
  mocks.getUser.mockResolvedValue({ data: { user: { id: reference, email_confirmed_at: "2026-10-15" } }, error: null })
  mocks.accountRpc.mockResolvedValueOnce({ data: state, error: null }).mockResolvedValueOnce({ data: { state: "submitted" }, error: null })
  const read = request(); read.headers.delete("cookie")
  expect((await handleGuestFiscalFollowup(read)).status).toBe(200)
  const correct = request({ operation: "resubmit", reference, requestId: reference, version: state.version, application: answers }); correct.headers.delete("cookie")
  expect(await (await handleGuestFiscalFollowup(correct)).json()).toEqual({ state: "submitted" })
  expect(mocks.accountRpc).toHaveBeenCalledWith("read_linked_fiscal_application", { p_reference: reference })
  expect(mocks.accountRpc).toHaveBeenLastCalledWith("resubmit_linked_fiscal_application", expect.objectContaining({ p_reference: reference, p_application: guestApplicationPayload(answers) }))
  expect(mocks.rpc.mock.calls.every(([name]) => name === "consume_fiscal_guest_limit")).toBe(true)
 })
 it("requires confirmed server identity and an explicit claim for account return", async () => {
  vi.stubEnv("FISCAL_GUEST_PROFILE_IMPORT_ENABLED", "true")
  const read = () => { const input = request(); input.headers.delete("cookie"); return input }
  expect((await handleGuestFiscalFollowup(read())).status).toBe(403)
  mocks.getUser.mockResolvedValue({ data: { user: { id: reference } }, error: null })
  expect((await handleGuestFiscalFollowup(read())).status).toBe(403)
  expect(mocks.accountRpc).not.toHaveBeenCalled()
  mocks.getUser.mockResolvedValue({ data: { user: { id: reference, email_confirmed_at: "2026-10-15" } }, error: null })
  expect((await handleGuestFiscalFollowup(read())).status).toBe(403)
 })
 it("lists only the authenticated account RPC result and hides anonymous/disabled discovery", async () => {
  expect(await loadLinkedFiscalApplications()).toEqual({ applications: [] })
  expect(mocks.getUser).not.toHaveBeenCalled()
  vi.stubEnv("FISCAL_GUEST_PROFILE_IMPORT_ENABLED", "true")
  expect(await loadLinkedFiscalApplications()).toEqual({ applications: [] })
  mocks.getUser.mockResolvedValue({ data: { user: { id: reference, email_confirmed_at: "2026-10-15" } }, error: null })
  const applications = [{ reference, projectName: "Garden", status: "submitted", submittedAt: "2026-10-15" }]
  mocks.accountRpc.mockResolvedValue({ data: applications, error: null })
  expect(await loadLinkedFiscalApplications()).toEqual({ applications })
  expect(mocks.accountRpc).toHaveBeenLastCalledWith("list_linked_fiscal_applications")
  mocks.accountRpc.mockResolvedValue({ data: null, error: { message: "private schema details" } })
  expect(await loadLinkedFiscalApplications()).toEqual({ applications: [], error: expect.not.stringContaining("private schema") })
 })
 it("returns only validated applicant data with no-store headers", async () => {
  const response = await handleGuestFiscalFollowup(request())
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store")
  expect((await response.json()).application).toEqual(answers)
 })
 it("round trips existing editor answers including monthly amount, dates and yes explanations", () => {
  const parsed = parseGuestFollowup(state)
  const draft = guestCorrectionDraft(parsed.application!)
  expect(draft.fundraisingGoalDollars).toBe("123.45")
  const input = guestSubmissionInput(draft)
  expect(input.success).toBe(true)
  if (input.success) expect(input.data.application).toEqual(answers)
 })
 it("blocks cross-origin and missing capability before database work", async () => {
  expect((await handleGuestFiscalFollowup(request(undefined, "https://evil.test"))).status).toBe(403)
  const noCookie = request(); noCookie.headers.delete("cookie")
  expect((await handleGuestFiscalFollowup(noCookie)).status).toBe(403)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it("returns the same generic denial for unknown, unverified and expired application access", async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : null, error: null }))
  expect((await handleGuestFiscalFollowup(request())).status).toBe(403)
 })
 it("rejects caller-controlled state and malformed answers", async () => {
  expect((await handleGuestFiscalFollowup(request({ operation: "read", reference, userId: reference }))).status).toBe(400)
  expect((await handleGuestFiscalFollowup(request({ operation: "resubmit", reference, requestId: reference, version: state.version, application: { ...answers, status: "approved" } }))).status).toBe(400)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it("submits normalized answers with version and stable request ID", async () => {
  const response = await handleGuestFiscalFollowup(request({ operation: "resubmit", reference, requestId: reference, version: state.version, application: answers }))
  expect(response.status).toBe(200)
  expect(mocks.rpc).toHaveBeenCalledWith("resubmit_fiscal_guest_application", expect.objectContaining({ p_reference: reference, p_request_id: reference, p_version: state.version, p_application: guestApplicationPayload(answers) }))
 })
 it.each([["conflict",409],["email_change",400]] as const)("handles %s without pretending corrections were accepted", async (state, code) => {
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : { state }, error: null }))
  expect((await handleGuestFiscalFollowup(request({ operation: "resubmit", reference, requestId: reference, version: "a".repeat(32), application: answers }))).status).toBe(code)
 })
 it("fails closed on disabled configuration, rate limits and database errors", async () => {
  vi.stubEnv("FISCAL_GUEST_INTAKE_ENABLED", "false")
  expect((await handleGuestFiscalFollowup(request())).status).toBe(503); expect(mocks.rpc).not.toHaveBeenCalled()
  vi.stubEnv("FISCAL_GUEST_INTAKE_ENABLED", "true"); mocks.rpc.mockResolvedValue({ data: false, error: null })
  expect((await handleGuestFiscalFollowup(request())).status).toBe(429)
  mocks.rpc.mockRejectedValue(new Error("private database error"))
  const response = await handleGuestFiscalFollowup(request())
  expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("private database")
 })
 it("excludes applicant return URLs from analytics", () => {
  expect(filterPrivateTelemetry({ url: `https://coach.test/documentation/fiscal-sponsorship/application?application=${reference}` })).toBeNull()
 })
})
