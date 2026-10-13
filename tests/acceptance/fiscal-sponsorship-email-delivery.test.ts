import { createHmac } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), admin: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/lib/env", () => ({ env: { RESEND_API_KEY: "re_test", RESEND_WEBHOOK_SECRET: "whsec_" + Buffer.from("test-webhook-signing-key").toString("base64") } }))
import { POST } from "@/app/api/webhooks/resend/route"
import { recordVerifiedFiscalDelivery } from "@/lib/email/fiscal-delivery"

const event = {
  type: "email.delivered", created_at: "2026-10-11T12:00:00.000Z",
  data: { email_id: "provider-id", tags: { category: "fiscal-receipt" }, to: ["private@example.test"], subject: "Private", html: "private-token" },
}
function signedRequest(payload = JSON.stringify(event), signatureOverride?: string) {
  const id = "msg_test", timestamp = String(Math.floor(Date.now() / 1000))
  const signature = createHmac("sha256", Buffer.from("dGVzdC13ZWJob29rLXNpZ25pbmcta2V5", "base64")).update(`${id}.${timestamp}.${payload}`).digest("base64")
  return new NextRequest("https://coach.test/api/webhooks/resend", { method: "POST", body: payload,
    headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signatureOverride ?? `v1,${signature}` } })
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("FISCAL_EMAIL_TRACKING_ENABLED", "true")
  mocks.admin.mockReturnValue({ rpc: mocks.rpc })
  mocks.rpc.mockResolvedValue({ error: null })
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe("fiscal provider receipts", () => {
  it("verifies the real signature before storing only the allowlisted receipt", async () => {
    expect((await POST(signedRequest())).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("record_fiscal_email_delivery", {
      p_event_id: "msg_test", p_message_id: "provider-id", p_event_type: "email.delivered", p_occurred_at: event.created_at,
    })
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toMatch(/private|subject|html/)
  })
  it("preserves global bounce suppression while keeping fiscal payloads out of campaign history", async () => {
    const table = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), insert: vi.fn().mockResolvedValue({ error: null }) }
    const from = vi.fn(() => table)
    mocks.admin.mockReturnValue({ rpc: mocks.rpc, from })
    expect((await POST(signedRequest(JSON.stringify({ ...event, type: "email.bounced" })))).status).toBe(200)
    expect(from).toHaveBeenCalledWith("platform_email_suppressions")
    expect(from).toHaveBeenCalledWith("platform_email_consent_events")
    expect(from).not.toHaveBeenCalledWith("platform_email_events")
    expect(table.insert).toHaveBeenCalledWith(expect.objectContaining({ email: "private@example.test", reason: "bounce" }))
  })
  it("denies forged signatures without touching storage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect((await POST(signedRequest(undefined, "v1,invalid"))).status).toBe(400)
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("lets Resend retry failed storage without logging private payloads", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "unavailable" } })
    expect((await POST(signedRequest())).status).toBe(503)
  })
  it("keeps in-flight receipts independent from the sending switch", async () => {
    vi.stubEnv("FISCAL_GUEST_EMAILS_ENABLED", "false")
    expect((await POST(signedRequest())).status).toBe(200)
  })
  it("does not acknowledge a tracked event when tracking is unconfigured", async () => {
    vi.stubEnv("FISCAL_EMAIL_TRACKING_ENABLED", "false")
    expect((await POST(signedRequest())).status).toBe(503)
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("does not divert nonfiscal campaign events", async () => {
    expect(await recordVerifiedFiscalDelivery("event", { ...event, data: { ...event.data, tags: { category: "campaign" } } })).toBe(false)
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("ignores fiscal open/click tracking without storing private payloads", async () => {
    expect((await POST(signedRequest(JSON.stringify({ ...event, type: "email.opened" })))).status).toBe(200)
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("rejects malformed signed receipts instead of fabricating event timestamps", async () => {
    expect((await POST(signedRequest(JSON.stringify({ ...event, created_at: "invalid" })))).status).toBe(503)
    expect(mocks.admin).not.toHaveBeenCalled()
  })
})
