import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("@/lib/email/resend", () => ({ sendResendEmail: mocks.send, canSendResendEmail: () => true }))
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_SITE_URL: "https://coachhouse.app" } }))
import { dispatchFiscalGuestEmails } from "@/features/fiscal-sponsorship/server/guest-email-dispatch"
import { dispatchFiscalStaffEmails } from "@/features/fiscal-sponsorship/server/staff-email-dispatch"

const id = "20000000-0000-4000-8000-000000000001"
const projectId = "20000000-0000-4000-8000-000000000002"
const leaseToken = "20000000-0000-4000-8000-000000000003"
const submissionId = "20000000-0000-4000-8000-000000000004"
const team = ["joel@coachhousesolutions.org", "fs@coachhousesolutions.org"]
const cc = ["caleb@bandto.com"]
const review = { project_name: "Northside", applicant_full_name: "Jordan Lee", primary_email: "jordan@example.test", project_description: "Community food <garden>", fundraising_goal: { amountCents: 5000000, period: "annually" }, received_at: "2026-10-16T20:00:00Z" }
const guest = { id, projectId, submissionId, leaseToken, recipient: team[0], kind: "reviewer_notification", templateVersion: 2, messageSnapshot: { projectName: "Northside", eventType: "application_submitted" }, toRecipients: team, ccRecipients: cc, reviewSnapshot: review }
const staff = { event_id: id, project_id: projectId, lease_token: leaseToken, event_type: "application_submitted", template_version: 2, message_snapshot: { projectName: "Northside" }, to_recipients: team, cc_recipients: cc, review_snapshot: review }

function useJobs(lane: "guest" | "staff", jobs: unknown[], allowed: { data: unknown; error: unknown } = { data: true, error: null }) {
  let proof: object | null = null
  mocks.rpc.mockImplementation(async (name: string, args?: Record<string, string>) => {
    if (name === "prepare_fiscal_guest_email_proof") {
      proof ??= { nonce: args!.p_nonce, expiresAt: args!.p_expires_at, tokenHash: args!.p_token_hash }
      return { data: proof, error: null }
    }
    if (name === `fiscal_${lane}_email_send_allowed`) return allowed
    if (name === (lane === "guest" ? "claim_fiscal_guest_emails_v4" : "claim_fiscal_staff_emails_v2")) return { data: jobs, error: null }
    return { data: true, error: null }
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("FISCAL_GUEST_EMAILS_ENABLED", "true")
  vi.stubEnv("FISCAL_STAFF_EMAILS_ENABLED", "true")
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://coachhouse.app")
  vi.stubEnv("FISCAL_GUEST_LINK_SECRET", "private-test-link-secret-with-more-than-32-characters")
  mocks.send.mockResolvedValue({ ok: true, id: "provider-id" })
})
afterEach(() => vi.unstubAllEnvs())

describe("versioned minimal fiscal delivery", () => {
  it.each([false, true])("sends one guest team digest, corrections=%s, with frozen recipient/body/key", async (corrections) => {
    useJobs("guest", [{ ...guest, kind: corrections ? "reviewer_update" : "reviewer_notification" }])
    expect(await dispatchFiscalGuestEmails()).toEqual({ sent: 1, failed: 0 })
    await dispatchFiscalGuestEmails()
    const mail = mocks.send.mock.calls[0][0]
    expect(mail).toMatchObject({ to: team, cc, subject: `${corrections ? "FS corrections received" : "New FS application"}: Northside` })
    expect(mail.text).toContain("Community food <garden>")
    expect(mail.html).toContain("Community food &lt;garden&gt;")
    expect(mail.html).toContain("coach-house-logo-dark.png")
    expect(mail.text).not.toContain("#verify=")
    expect(mail.idempotencyKey).toBe(`fiscal-minimal-v1/${corrections ? "reviewer_update" : "reviewer_notification"}/${id}`)
    expect(JSON.stringify(mocks.send.mock.calls[1][0])).toBe(JSON.stringify(mail))
    expect(mocks.rpc).toHaveBeenCalledWith("fiscal_guest_email_send_allowed", { p_id: id, p_lease_token: leaseToken })
    expect(mocks.rpc.mock.calls.some(([name]) => name === "prepare_fiscal_guest_email_proof")).toBe(false)
  })

  it.each([false, true])("uses the same full team for non-guest application/corrections=%s", async (corrections) => {
    useJobs("staff", [{ ...staff, review_snapshot: { ...review, corrections } }])
    expect(await dispatchFiscalStaffEmails()).toEqual({ sent: 1, failed: 0 })
    await dispatchFiscalStaffEmails()
    const mail = mocks.send.mock.calls[0][0]
    expect(mail).toMatchObject({ to: team, cc, subject: `${corrections ? "FS corrections received" : "New FS application"}: Northside`, idempotencyKey: `fiscal-staff-minimal-v1/${id}` })
    expect(JSON.stringify(mocks.send.mock.calls[1][0])).toBe(JSON.stringify(mail))
    expect(mocks.rpc).toHaveBeenCalledWith("fiscal_staff_email_send_allowed", { p_event_id: id, p_lease_token: leaseToken })
  })

  it("keeps other staff milestones FS-only", async () => {
    useJobs("staff", [{ ...staff, event_type: "application_approved", review_snapshot: null, to_recipients: [team[1]], cc_recipients: [] }])
    expect(await dispatchFiscalStaffEmails()).toEqual({ sent: 1, failed: 0 })
    expect(mocks.send.mock.calls[0][0].to).toEqual([team[1]])
    expect(mocks.send.mock.calls[0][0]).not.toHaveProperty("cc")
  })

  it.each(["applicant_receipt", "applicant_update", "applicant_recovery"])("redesigns %s without copying its private link", async (kind) => {
    useJobs("guest", [{ ...guest, kind, recipient: "jordan@example.test", toRecipients: [], ccRecipients: [], reviewSnapshot: null,
      receiptSnapshot: kind === "applicant_receipt" ? {
        applicant_first_name: "Jordan", applicant_last_name: "Lee", primary_email: "jordan@example.test",
        mailing_street_address: "1 Main Street", mailing_city: "Chicago", mailing_state: "IL", mailing_postal_code: "60601",
        legal_entity_type: "individual", project_name: "Northside", project_description: "Food garden",
        project_duration_type: "ongoing_multi_year", fundraising_goal: { amountCents: 5000000, period: "annually" },
        prospective_funding_sources: "Neighbors", public_benefit: "Grow food", operates_outside_united_states: false,
        engages_in_lobbying: false, has_legal_compliance_financial_concerns: false,
      } : null }])
    await dispatchFiscalGuestEmails()
    await dispatchFiscalGuestEmails()
    const mail = mocks.send.mock.calls[0][0]
    expect(mail.to).toBe("jordan@example.test")
    expect(mail).not.toHaveProperty("cc")
    expect(mail.html).toContain("coach-house-logo-dark.png")
    expect(mail.text).toContain("#verify=v1.")
    expect(mail.text).not.toContain("/projects/")
    expect(mail.idempotencyKey).toBe(`fiscal-minimal-v1/${kind}/${id}`)
    expect(JSON.stringify(mocks.send.mock.calls[1][0])).toBe(JSON.stringify(mail))
  })

  it.each(["guest", "staff"] as const)("withholds %s mail when access is revoked after claim", async (lane) => {
    useJobs(lane, [lane === "guest" ? guest : staff], { data: false, error: null })
    expect(await (lane === "guest" ? dispatchFiscalGuestEmails() : dispatchFiscalStaffEmails())).toEqual({ sent: 0, failed: 1 })
    expect(mocks.send).not.toHaveBeenCalled()
    const finish = mocks.rpc.mock.calls.find(([name]) => name === `finish_fiscal_${lane}_email`)!
    expect(finish[1]).toMatchObject({ p_success: false, p_message_id: null })
  })

  it.each(["guest", "staff"] as const)("fails closed on %s pre-send lookup errors", async (lane) => {
    useJobs(lane, [lane === "guest" ? guest : staff], { data: true, error: { code: "08006" } })
    expect(await (lane === "guest" ? dispatchFiscalGuestEmails() : dispatchFiscalStaffEmails())).toEqual({ sent: 0, failed: 1 })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it.each([
    { ...guest, ccRecipients: [] },
    { ...guest, toRecipients: [team[0]] },
    { ...guest, reviewSnapshot: null },
    { ...guest, messageSnapshot: null },
    { ...guest, kind: "applicant_update", recipient: "jordan@example.test" },
  ])("withholds malformed modern guest envelopes", async (job) => {
    useJobs("guest", [job])
    expect(await dispatchFiscalGuestEmails()).toEqual({ sent: 0, failed: 1 })
    expect(mocks.send).not.toHaveBeenCalled()
  })
})
