import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
import { handleGuestFiscalDraft } from "@/features/fiscal-sponsorship/server/guest-draft"
import { handleGuestFiscalDraftRetention } from "@/features/fiscal-sponsorship/server/guest-draft-retention"
import { GUEST_COOKIE, hashGuestCapability, issueGuestCapability } from "@/features/fiscal-sponsorship/server/guest-request-security"
import { guestDraftSchema, pickGuestFiscalDraft } from "@/features/fiscal-sponsorship/lib/guest-draft"
import { buildFiscalSponsorshipApplicationDraft } from "@/features/fiscal-sponsorship/lib/application-draft"

const secret = "test-secret-at-least-thirty-two-characters"
const requestId = "20000000-0000-4000-8000-000000000001"
const saved = { state: "draft", version: 1, draft: { primaryEmail: "unfinished@", projectName: "  Garden  " }, expiresAt: "2026-10-17T00:00:00+00:00" }
function request(body: unknown = { operation: "read" }, options: { cookie?: string; origin?: string } = {}) {
  return new Request("https://coach.test/api/public/fiscal-sponsorship/draft", {
    method: "POST", headers: { origin: options.origin ?? "https://coach.test", "content-type": "application/json", cookie: `${GUEST_COOKIE}=${options.cookie ?? issueGuestCapability(secret)}` },
    body: JSON.stringify(body),
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("FISCAL_GUEST_INTAKE_ENABLED", "true")
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://coach.test")
  vi.stubEnv("FISCAL_GUEST_RISK_SECRET", secret)
  vi.stubEnv("HCAPTCHA_SECRET_KEY", "test-secret")
  vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "test-site-key")
  vi.stubEnv("VERCEL", "")
  vi.stubEnv("INTERNAL_CRON_SECRET", "private-scheduler-secret")
  vi.stubEnv("FISCAL_GUEST_RETENTION_ENABLED", "true")
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : saved, error: null }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

describe("private guest draft boundary", () => {
  it("resumes only the signed browser capability and never caches answers", async () => {
    const cookie = issueGuestCapability(secret)
    const response = await handleGuestFiscalDraft(request(undefined, { cookie }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(saved)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(mocks.rpc).toHaveBeenCalledWith("read_fiscal_guest_draft", {
      p_key_hash: hashGuestCapability(cookie), p_expires_at: new Date(Number(cookie.split(".")[1]) * 1000).toISOString(),
    })
  })
  it("preserves incomplete values, version and write ID for safe retries", async () => {
    const response = await handleGuestFiscalDraft(request({ operation: "save", version: 0, requestId, draft: saved.draft }))
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("save_fiscal_guest_draft", expect.objectContaining({ p_version: 0, p_request_id: requestId, p_draft: saved.draft }))
  })
  it.each(["projectId", "status", "metadata", "sourceSnapshot", "claimedUserId", "shortPublicDescription"])("rejects protected/removed field %s", async (field) => {
    const response = await handleGuestFiscalDraft(request({ operation: "save", version: 0, requestId, draft: { [field]: "forged" } }))
    expect(response.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("picks only public editable fields from the shared internal draft", () => {
    const draft = buildFiscalSponsorshipApplicationDraft({ data: { projectId: "internal", projectName: "Garden", applicantName: "" } })
    const selected = pickGuestFiscalDraft(draft)
    expect(selected.projectName).toBe("Garden")
    expect(selected).not.toHaveProperty("projectId")
    expect(selected).not.toHaveProperty("budgetRows")
    expect(guestDraftSchema.safeParse({ projectName: "x".repeat(201) }).success).toBe(false)
    expect(guestDraftSchema.safeParse({ primaryEmail: "unfinished@", temporaryStartDate: "2026-", fundraisingGoalDollars: "1," }).success).toBe(true)
  })
  it.each([{ state: "conflict" }, { state: "expired" }])("returns explicit $state without overwriting local answers", async (result) => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : result, error: null }))
    const response = await handleGuestFiscalDraft(request({ operation: "save", version: 0, requestId, draft: saved.draft }))
    expect(response.status).toBe(result.state === "conflict" ? 409 : 401)
    expect(await response.json()).toEqual(result)
  })
  it("returns only a receipt when the application was already submitted", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : { state: "submitted", reference: requestId }, error: null }))
    expect(await (await handleGuestFiscalDraft(request())).json()).toEqual({ state: "submitted", reference: requestId })
  })
  it("rejects cross-origin, forged and expired sessions before reads", async () => {
    expect((await handleGuestFiscalDraft(request(undefined, { origin: "https://other.test" }))).status).toBe(403)
    expect((await handleGuestFiscalDraft(request(undefined, { cookie: "forged" }))).status).toBe(401)
    const cookie = issueGuestCapability(secret)
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 8 * 86400000)
    expect((await handleGuestFiscalDraft(request(undefined, { cookie }))).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("stays off until explicitly enabled", async () => {
    vi.stubEnv("FISCAL_GUEST_INTAKE_ENABLED", "false")
    expect((await handleGuestFiscalDraft(request())).status).toBe(503)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("rejects oversized streamed data and caller-selected expiry", async () => {
    expect((await handleGuestFiscalDraft(request({ data: "x".repeat(65537) }))).status).toBe(400)
    expect((await handleGuestFiscalDraft(request({ operation: "read", expiresAt: "2099-01-01" }))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("enforces the durable limit before accessing answers", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    const response = await handleGuestFiscalDraft(request())
    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("60")
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
  it("reports uncertain saves without leaking provider details", async () => {
    mocks.rpc.mockRejectedValue(new Error("private connection detail"))
    const response = await handleGuestFiscalDraft(request())
    expect(response.status).toBe(503)
    expect(await response.text()).toContain("Keep this page open")
  })
  it("requires scheduler authentication for cleanup", async () => {
    expect((await handleGuestFiscalDraftRetention(new Request("https://coach.test"))).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("can delete expired drafts after submissions are disabled", async () => {
    vi.stubEnv("FISCAL_GUEST_INTAKE_ENABLED", "false")
    mocks.rpc.mockResolvedValue({ data: 500, error: null })
    const response = await handleGuestFiscalDraftRetention(new Request("https://coach.test", { headers: { authorization: "Bearer private-scheduler-secret" } }))
    expect(await response.json()).toEqual({ deleted: 500, proofsDeleted: 500, deliveryEventsDeleted: 0, morePossible: true })
    expect(mocks.rpc).toHaveBeenCalledWith("purge_expired_fiscal_guest_drafts")
  })
  it("keeps cleanup disabled until explicitly configured", async () => {
    vi.stubEnv("FISCAL_GUEST_RETENTION_ENABLED", "false")
    expect((await handleGuestFiscalDraftRetention(new Request("https://coach.test", { headers: { authorization: "Bearer private-scheduler-secret" } }))).status).toBe(503)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
