import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
import { signGuestEmailProof, validGuestEmailProof } from "@/features/fiscal-sponsorship/server/guest-email-proof-token"
import { handleGuestFiscalEmailVerification, prepareGuestEmailProofLink } from "@/features/fiscal-sponsorship/server/guest-email-proof"
import { GUEST_COOKIE, issueGuestCapability } from "@/features/fiscal-sponsorship/server/guest-request-security"
import { filterPrivateTelemetry } from "@/lib/telemetry-privacy"
const secret = "private-test-link-secret-with-more-than-32-characters"
const reference = "20000000-0000-4000-8000-000000000001"
const expiry = () => new Date(Date.now() + 86400000).toISOString()
const token = () => signGuestEmailProof(reference, "a".repeat(64), expiry(), secret)
const request = (body: unknown = { token: token() }, origin = "https://coach.test") => new Request("https://coach.test/api/public/fiscal-sponsorship/verify", {
 method: "POST", headers: { origin, "content-type": "application/json", cookie: `${GUEST_COOKIE}=${issueGuestCapability(secret)}` }, body: JSON.stringify(body),
})
beforeEach(() => {
 vi.resetAllMocks()
 vi.stubEnv("FISCAL_GUEST_LINK_SECRET", secret); vi.stubEnv("FISCAL_GUEST_RISK_SECRET", secret)
 vi.stubEnv("FISCAL_GUEST_INTAKE_ENABLED", "true"); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://coach.test")
 vi.stubEnv("HCAPTCHA_SECRET_KEY", "test-secret"); vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "test-site"); vi.stubEnv("VERCEL", "")
 mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : { reference }, error: null }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })
describe("explicit guest email proof", () => {
 it("excludes verification URLs from both telemetry providers before or after fragment removal", () => {
  for (const suffix of ["", "/", "#verify=secret", "?unexpected=secret#verify=secret"]) {
   expect(filterPrivateTelemetry({ type: "pageview", url: `https://coach.test/documentation/fiscal-sponsorship/verify${suffix}` })).toBeNull()
   expect(filterPrivateTelemetry({ type: "pageview", url: `https://coach.test/documentation/fiscal-sponsorship/profile${suffix}` })).toBeNull()
  }
  const publicEvent = { type: "vital", url: "https://coach.test/resources" }
  expect(filterPrivateTelemetry(publicEvent)).toBe(publicEvent)
  expect(filterPrivateTelemetry({ url: "invalid" })).toBeNull()
 })
 it("rejects tampering, wrong signing keys and expired links", () => {
  const value = token()
  expect(validGuestEmailProof(value, secret)).toBe(true)
  expect(validGuestEmailProof(value, "other-secret")).toBe(false)
  expect(validGuestEmailProof(value.replace("v1.", "v2."), secret)).toBe(false)
  vi.useFakeTimers(); vi.setSystemTime(Date.now()+2*86400000)
  expect(validGuestEmailProof(value, secret)).toBe(false)
 })
 it("verifies without an account and returns no internal identity data", async () => {
  const response = await handleGuestFiscalEmailVerification(request())
  expect(await response.json()).toEqual({ ok: true, reference })
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(mocks.rpc).toHaveBeenCalledWith("verify_fiscal_guest_email", expect.objectContaining({ p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/), p_key_hash: expect.stringMatching(/^[a-f0-9]{64}$/) }))
 })
 it("rejects cross-origin or malformed proof before database access", async () => {
  expect((await handleGuestFiscalEmailVerification(request(undefined,"https://evil.test"))).status).toBe(403)
  expect((await handleGuestFiscalEmailVerification(request({ token: "forged" }))).status).toBe(400)
  expect((await handleGuestFiscalEmailVerification(request({ token: token(), userId: reference }))).status).toBe(400)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it("does not accept a reference number as email proof", async () => {
  expect((await handleGuestFiscalEmailVerification(request({ token: reference }))).status).toBe(400)
 })
 it("fails closed when the browser session is absent", async () => {
  const input = request(); input.headers.delete("cookie")
  expect((await handleGuestFiscalEmailVerification(input)).status).toBe(401)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it("returns a generic failure for an expired or already used stored proof", async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_fiscal_guest_limit" ? true : null, error: null }))
  expect((await handleGuestFiscalEmailVerification(request())).status).toBe(400)
 })
 it("checks durable limits before recording verification", async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null })
  expect((await handleGuestFiscalEmailVerification(request())).status).toBe(429)
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
 })
 it("freezes retry links and keeps proof tokens in fragments instead of query strings", async () => {
  let stored: object | null = null
  mocks.rpc.mockImplementation(async (_name: string, args: Record<string,string>) => {
   stored ??= { nonce: args.p_nonce, expiresAt: args.p_expires_at, tokenHash: args.p_token_hash }
   return { data: stored, error: null }
  })
  const first = await prepareGuestEmailProofLink(reference,reference,new URL("https://coach.test"))
  const next = await prepareGuestEmailProofLink(reference,reference,new URL("https://coach.test"))
  expect(next).toBe(first)
  expect(new URL(first).search).toBe("")
  expect(new URL(first).hash).toContain("#verify=v1.")
  vi.stubEnv("FISCAL_GUEST_LINK_SECRET", "changed-key-at-least-thirty-two-characters")
  await expect(prepareGuestEmailProofLink(reference,reference,new URL("https://coach.test"))).rejects.toThrow("key mismatch")
 })
 it("keeps inactive environments closed", async () => {
  vi.stubEnv("FISCAL_GUEST_INTAKE_ENABLED", "false")
  expect((await handleGuestFiscalEmailVerification(request())).status).toBe(503)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
})
