import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("@/lib/email/resend", () => ({ sendResendEmail: mocks.send, canSendResendEmail: () => true }))
import { dispatchFiscalGuestEmails, handleGuestFiscalEmailCron } from "@/features/fiscal-sponsorship/server/guest-email-dispatch"
const job = { id: "20000000-0000-4000-8000-000000000001", submissionId: "20000000-0000-4000-8000-000000000002", projectId: "20000000-0000-4000-8000-000000000003", kind: "applicant_receipt", recipient: "guest@example.test", leaseToken: "20000000-0000-4000-8000-000000000004" }
beforeEach(() => {
 vi.resetAllMocks()
 vi.stubEnv("FISCAL_GUEST_EMAILS_ENABLED", "true")
 vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://coach.test")
 vi.stubEnv("INTERNAL_CRON_SECRET", "test-cron-secret")
 vi.stubEnv("FISCAL_GUEST_LINK_SECRET", "private-test-link-secret-with-more-than-32-characters")
 let proof: object | null = null
 mocks.rpc.mockImplementation(async (name: string, args?: Record<string, string>) => {
  if (name === "prepare_fiscal_guest_email_proof") proof ??= { nonce: args!.p_nonce, expiresAt: args!.p_expires_at, tokenHash: args!.p_token_hash }
  return { data: name === "claim_fiscal_guest_emails" ? [job] : name === "prepare_fiscal_guest_email_proof" ? proof : true, error: null }
 })
 mocks.send.mockResolvedValue({ ok: true, id: "provider-id" })
})
afterEach(() => vi.unstubAllEnvs())
describe("guest receipt delivery", () => {
 it("sends recovery links with stable copy and no internal project information", async () => {
  const original = mocks.rpc.getMockImplementation()!
  mocks.rpc.mockImplementation(async (name: string, args?: Record<string, string>) => name === "claim_fiscal_guest_emails" ? { data: [{ ...job, kind: "applicant_recovery" }], error: null } : original(name, args))
  await dispatchFiscalGuestEmails(); await dispatchFiscalGuestEmails()
  const first = mocks.send.mock.calls[0][0], second = mocks.send.mock.calls[1][0]
  expect(second).toMatchObject(first)
  expect(first.subject).toBe("Your application access link")
  expect(first.idempotencyKey).toBe(`fiscal-guest-recovery-v1/${job.id}`)
  expect(first.html).toContain('/verify#verify=v1.')
  expect(first.text).not.toContain('/projects/')
  expect(first.text).toContain('Your application has not changed.')
 })
 it("sends a receipt without private answers, auth requirements or internal project links", async () => {
  expect(await dispatchFiscalGuestEmails()).toEqual({ sent: 1, failed: 0 })
  const mail = mocks.send.mock.calls[0][0]
  expect(mail.to).toBe(job.recipient)
  expect(mail.text).toContain("You do not need an account")
  expect(mail.text).not.toContain("/projects/")
  expect(mail.text).toContain("does not mean your project has been approved")
  expect(mail.html).toContain('/verify#verify=v1.')
  expect(mail.text).toContain("Opening it does not verify your email")
  expect(mocks.rpc).toHaveBeenCalledWith("finish_fiscal_guest_email", { p_id: job.id, p_lease_token: job.leaseToken, p_success: true, p_message_id: "provider-id" })
 })
 it("keeps retry payloads and provider keys identical", async () => {
  await dispatchFiscalGuestEmails(); await dispatchFiscalGuestEmails()
  const first = mocks.send.mock.calls[0][0], second = mocks.send.mock.calls[1][0]
  expect(second).toMatchObject({ text: first.text, html: first.html, to: first.to, subject: first.subject, idempotencyKey: first.idempotencyKey })
 })
 it("records provider failure for backoff without storing its raw error", async () => {
  mocks.send.mockRejectedValue(new Error("private data"))
  expect(await dispatchFiscalGuestEmails()).toEqual({ sent: 0, failed: 1 })
  expect(mocks.rpc).toHaveBeenCalledWith("finish_fiscal_guest_email", { p_id: job.id, p_lease_token: job.leaseToken, p_success: false, p_message_id: null })
 })
 it("does not report success after a stale or failed acknowledgement", async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "claim_fiscal_guest_emails" ? [{ ...job, kind: "reviewer_notification" }] : false, error: null }))
  await expect(dispatchFiscalGuestEmails()).rejects.toThrow("could not be recorded")
 })
 it("requires explicit delivery activation and authenticated cron", async () => {
  expect((await handleGuestFiscalEmailCron(new Request("https://coach.test/api/cron"))).status).toBe(401)
  vi.stubEnv("FISCAL_GUEST_EMAILS_ENABLED", "false")
  await expect(dispatchFiscalGuestEmails()).rejects.toThrow("not configured")
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it.each(["applicant_update", "reviewer_update"])("delivers %s with stable private follow-up links", async (kind) => {
  let proof: object | null = null
  mocks.rpc.mockImplementation(async (name: string, args?: Record<string, string>) => {
   if (name === "prepare_fiscal_guest_email_proof") proof ??= { nonce: args!.p_nonce, expiresAt: args!.p_expires_at, tokenHash: args!.p_token_hash }
   return { data: name === "claim_fiscal_guest_emails" ? [{ ...job, kind }] : name === "prepare_fiscal_guest_email_proof" ? proof : true, error: null }
  })
  await dispatchFiscalGuestEmails(); await dispatchFiscalGuestEmails()
  const mail = mocks.send.mock.calls[0][0]
  expect(mail.subject).toBe("Fiscal sponsorship application updated")
  expect(mail.idempotencyKey).toContain("update-v1")
  expect(mail.text).toContain(kind === "applicant_update" ? "/verify#verify=" : "/projects/")
  if (kind === "applicant_update") expect(mail.text).not.toContain("/projects/")
  expect(mocks.send.mock.calls[1][0]).toMatchObject({ text: mail.text, html: mail.html, idempotencyKey: mail.idempotencyKey })
 })
 it("routes reviewer mail to its private project, never the applicant's public profile", async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "claim_fiscal_guest_emails" ? [{ ...job, kind: "reviewer_notification", recipient: "joel@coachhousesolutions.org" }] : true, error: null }))
  await dispatchFiscalGuestEmails()
  expect(mocks.send.mock.calls[0][0].text).toContain(`https://coach.test/projects/${job.projectId}`)
 })
})
