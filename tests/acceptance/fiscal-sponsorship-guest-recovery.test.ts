import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), fetch: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
import { handleGuestFiscalRecovery } from "@/features/fiscal-sponsorship/server/guest-recovery"
import { filterPrivateTelemetry } from "@/lib/telemetry-privacy"
const reference = "20000000-0000-4000-8000-000000000001"
const body = { reference, requestId: "20000000-0000-4000-8000-000000000002", email: "Guest@example.test", captchaToken: "proof" }
const request = (value: unknown = body, origin = "https://coach.test") => new Request("https://coach.test/api/public/fiscal-sponsorship/recover", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(value),
})
beforeEach(() => {
  vi.resetAllMocks()
  for (const flag of ["FISCAL_GUEST_INTAKE_ENABLED", "FISCAL_GUEST_EMAILS_ENABLED"]) vi.stubEnv(flag, "true")
  for (const key of ["FISCAL_GUEST_RISK_SECRET", "FISCAL_GUEST_LINK_SECRET"]) vi.stubEnv(key, "private-test-secret-with-more-than-32-characters")
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://coach.test"); vi.stubEnv("VERCEL", "")
  vi.stubEnv("HCAPTCHA_SECRET_KEY", "test-secret"); vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "test-site")
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : null, error: null }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("private application recovery", () => {
  it("requires no existing account or cookie and only queues a scoped request", async () => {
    const response = await handleGuestFiscalRecovery(request())
    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ ok: true })
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.has("set-cookie")).toBe(false)
    expect(mocks.rpc).toHaveBeenCalledWith("request_fiscal_guest_recovery", { p_reference: reference, p_email: "guest@example.test", p_request_id: body.requestId })
  })
  it("does not reveal email limits or an unknown application in its response", async () => {
    const first = await handleGuestFiscalRecovery(request())
    mocks.rpc.mockClear().mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null })
    mocks.fetch.mockResolvedValue(new Response('{"success":true}'))
    const limited = await handleGuestFiscalRecovery(request())
    expect(limited.status).toBe(first.status)
    expect(await limited.json()).toEqual(await first.json())
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
  })
  it("rejects foreign origins, malformed input and injected ownership before storage", async () => {
    expect((await handleGuestFiscalRecovery(request(body, "https://evil.test"))).status).toBe(403)
    expect((await handleGuestFiscalRecovery(request({ ...body, userId: reference }))).status).toBe(400)
    expect((await handleGuestFiscalRecovery(request({ ...body, reference: "guess" }))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it("checks IP limits before captcha and rejects failed verification", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null })
    expect((await handleGuestFiscalRecovery(request())).status).toBe(429)
    expect(mocks.fetch).not.toHaveBeenCalled()
    mocks.fetch.mockResolvedValue(new Response('{"success":false}'))
    expect((await handleGuestFiscalRecovery(request())).status).toBe(400)
    expect(mocks.rpc.mock.calls.some(([name]) => name === "request_fiscal_guest_recovery")).toBe(false)
  })
  it("fails closed on limit or queue failures without exposing provider errors", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "private detail" } })
    expect((await handleGuestFiscalRecovery(request())).status).toBe(503)
    mocks.rpc.mockImplementation(async (name: string) => name === "consume_fiscal_guest_limit" ? { data: true, error: null } : { error: { message: "private queue detail" } })
    const response = await handleGuestFiscalRecovery(request())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain("private queue detail")
  })
  it("preserves the request key on retries and never includes raw IPs in limits", async () => {
    await handleGuestFiscalRecovery(request())
    mocks.fetch.mockResolvedValue(new Response('{"success":true}'))
    await handleGuestFiscalRecovery(request())
    const writes = mocks.rpc.mock.calls.filter(([name]) => name === "request_fiscal_guest_recovery")
    expect(writes).toHaveLength(2)
    expect(writes[0]).toEqual(writes[1])
    for (const [, args] of mocks.rpc.mock.calls.filter(([name]) => name === "consume_fiscal_guest_limit")) expect(args.p_key_hash).toMatch(/^[a-f0-9]{64}$/)
  })
  it("stays disabled without intake, delivery or link configuration", async () => {
    vi.stubEnv("FISCAL_GUEST_EMAILS_ENABLED", "false")
    expect((await handleGuestFiscalRecovery(request())).status).toBe(503)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("excludes recovery references from telemetry", () => {
    expect(filterPrivateTelemetry({ url: `https://coach.test/documentation/fiscal-sponsorship/recover?application=${reference}` })).toBeNull()
  })
})
